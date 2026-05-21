# ========================
# IMPORTS
# ========================
from django.shortcuts import render, redirect
from django.contrib import messages
from django.core.mail import send_mail
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from django.db.models import Sum, F
import jwt
from datetime import datetime, timedelta

import hashlib
import json
import secrets
from datetime import date, timedelta
import calendar
import threading

from .models import User, Product, Transaction, TransactionItem, StockIn


# ========================
# UTILITIES
# ========================
def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()


def create_jwt_token(user):
    payload = {
        'user_id': str(user.user_id),
        'username': user.username,
        'role': user.role,
        'exp': datetime.utcnow() + timedelta(days=7),
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm='HS256')
    if isinstance(token, bytes):
        token = token.decode('utf-8')
    return token


def get_jwt_from_request(request):
    auth = request.META.get('HTTP_AUTHORIZATION', '')
    if auth and auth.lower().startswith('bearer '):
        return auth.split(' ', 1)[1].strip()
    return request.COOKIES.get('jwt_token')


def get_jwt_user(request):
    token = get_jwt_from_request(request)
    if not token:
        return None

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
        user_id = payload.get('user_id')
        if not user_id:
            return None
        return User.objects.get(user_id=user_id)
    except (jwt.ExpiredSignatureError, jwt.DecodeError, User.DoesNotExist):
        return None


def parse_json_body(request):
    body = request.body
    if isinstance(body, bytes):
        body = body.decode('utf-8', errors='replace').strip()
    if not body:
        return {}

    try:
        return json.loads(body)
    except json.JSONDecodeError:
        if body.startswith('{') and "'" in body and '"' not in body:
            try:
                return json.loads(body.replace("'", '"'))
            except json.JSONDecodeError:
                pass
        if request.POST:
            return {k: v for k, v in request.POST.items()}
        raise


def is_logged_in(request):
    return 'user_id' in request.session


def is_admin(request):
    return request.session.get('role') == 'admin'


def validate_jwt_admin(request):
    """Validates JWT token and checks if user is admin. Returns (user, error_response) tuple."""
    user = get_jwt_user(request)
    if not user:
        return None, JsonResponse({'success': False, 'message': 'Invalid or expired token.'}, status=401)
    if user.role != 'admin':
        return None, JsonResponse({'success': False, 'message': 'Admin Only'}, status=403)
    return user, None

# ========================
# AUTHENTICATION
# ========================
def login_view(request):
    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        password = request.POST.get('password', '')

        try:
            user = User.objects.get(username=username)

            if user.password != hash_password(password):
                messages.error(request, 'Invalid password.')
                return render(request, 'auth/login.html')

            if not user.is_verified:
                messages.error(request, 'Please verify your email first. Check your inbox.')
                return render(request, 'auth/login.html')

            request.session['user_id']  = str(user.user_id)
            request.session['username'] = user.username
            request.session['role']     = user.role

            token = create_jwt_token(user)
            response = redirect('dashboard' if user.role == 'admin' else 'products')
            response.set_cookie(
                'jwt_token',
                token,
                httponly=True,
                samesite='Lax',
                max_age=7 * 24 * 60 * 60,
            )
            return response

        except User.DoesNotExist:
            messages.error(request, 'User not found.')

    return render(request, 'auth/login.html')


def logout_view(request):
    request.session.flush()
    response = redirect('login')
    response.delete_cookie('jwt_token')
    return response


def verify_email(request, token):
    try:
        user                    = User.objects.get(verification_token=token)
        user.is_verified        = True
        user.verification_token = None
        user.save()
        messages.success(request, f'Account verified! You can now log in, {user.username}.')
    except User.DoesNotExist:
        messages.error(request, 'Invalid or expired verification link.')
    return redirect('login')



# ========================
# EMAIL
# ========================
def send_verification_email(user, request, password_plain=''):
    token                   = secrets.token_urlsafe(32)
    user.verification_token = token
    user.save()

    base_url   = settings.FRONTEND_URL.rstrip('/')
    verify_url = f"{base_url}/verify/{token}/"
    login_url  = f"{base_url}/"

    send_mail(
        subject='Activate Your Staff Account',
        message=f"""Hello {user.username},

Your staff account has been created.

Click the link below to activate your account:
{verify_url}

Your login credentials:
Username: {user.username}
Password: {password_plain if password_plain else '(as set by admin)'}

After activation, you can log in at:
{login_url}

Regards,
Admin Team
""",
        from_email=settings.EMAIL_HOST_USER,
        recipient_list=[user.email],
        fail_silently=False,
    )




# ========================
# PAGE VIEWS
# ========================
def dashboard(request):
    if not is_logged_in(request):
        return redirect('login')
    if not is_admin(request):
        return redirect('products')
    return render(request, 'dashboard.html', {
        'username': request.session.get('username'),
        'role':     request.session.get('role'),
    })


def stock_in(request):
    if not is_logged_in(request):
        return redirect('login')
    return render(request, 'stock_in.html', {
        'username': request.session.get('username'),
        'role':     request.session.get('role'),
    })

def stock_in_history(request):
    """Page view for stock in transaction history"""
    if not is_logged_in(request):
        return redirect('login')
    if not is_admin(request):  # ← add this
        return redirect('products')
    return render(request, 'stock_in_history.html', {
        'username': request.session.get('username'),
        'role':     request.session.get('role'),
    })

def manage_users(request):
    if not is_logged_in(request):
        return redirect('login')
    if not is_admin(request):
        return redirect('products')
    return render(request, 'users.html', {
        'username': request.session.get('username'),
        'role':     request.session.get('role'),
    })


def products(request):
    if not is_logged_in(request):
        return redirect('login')
    return render(request, 'products.html', {
        'username': request.session.get('username'),
        'role':     request.session.get('role'),
    })




# ========================
# PRODUCT APIs
# ========================
def api_products_list(request):
    if not is_logged_in(request):
        return JsonResponse({'success': False, 'message': 'Not logged in.'}, status=401)

    products = Product.objects.all().values(
        'product_id', 'name', 'category', 'price', 'stock', 'unit', 'reorder_level'
    )
    return JsonResponse({'success': True, 'products': list(products)})


def api_products_add(request):
    if request.method == 'POST':
        if not is_logged_in(request):
            return JsonResponse({'success': False, 'message': 'Not logged in.'}, status=401)

        data = json.loads(request.body)
        name = data.get('name', '').strip()
        if not name:
            return JsonResponse({'success': False, 'message': 'Name is required.'})

        product = Product.objects.create(
            name          = name,
            category      = data.get('category', ''),
            unit          = data.get('unit', 'pieces'),
            price         = data.get('price', 0),
            stock         = data.get('stock', 0),
            reorder_level = data.get('reorder_level', 10),
        )
        return JsonResponse({'success': True, 'product_id': str(product.product_id)})


def api_products_edit(request, product_id):
    if request.method == 'POST':
        if not is_logged_in(request):
            return JsonResponse({'success': False, 'message': 'Not logged in.'}, status=401)

        data = json.loads(request.body)
        try:
            product               = Product.objects.get(product_id=product_id)
            product.name          = data.get('name', product.name)
            product.category      = data.get('category', product.category)
            product.unit          = data.get('unit', product.unit)
            product.price         = data.get('price', product.price)
            product.stock         = data.get('stock', product.stock)
            product.reorder_level = data.get('reorder_level', product.reorder_level)
            product.save()
            return JsonResponse({'success': True})
        except Product.DoesNotExist:
            return JsonResponse({'success': False, 'message': 'Product not found.'})


def api_products_delete(request, product_id):
    if request.method == 'POST':
        if not is_logged_in(request) or not is_admin(request):
            return JsonResponse({'success': False, 'message': 'Unauthorized.'}, status=403)

        try:
            Product.objects.get(product_id=product_id).delete()
            return JsonResponse({'success': True})
        except Product.DoesNotExist:
            return JsonResponse({'success': False, 'message': 'Product not found.'})


def stock_out(request):
    if not is_logged_in(request):
        return redirect('login')
    return render(request, 'stock_out.html', {
        'username': request.session.get('username'),
        'role':     request.session.get('role'),
    })




def pos(request):
    if not is_logged_in(request):
        return redirect('login')
    return render(request, 'pos.html', {
        'username': request.session.get('username'),
        'role':     request.session.get('role'),
    })


def orders(request):
    if not is_logged_in(request):
        return redirect('login')
    return render(request, 'orders.html', {
        'username': request.session.get('username'),
        'role':     request.session.get('role'),
    })


def reports(request):
    if not is_logged_in(request):
        return redirect('login')
    if not is_admin(request):
        return redirect('products')
    return render(request, 'reports.html', {
        'username': request.session.get('username'),
        'role':     request.session.get('role'),
    })


# ========================
# STOCK IN APIs
# ========================
def api_stock_in_list(request):
    if not is_logged_in(request):
        return JsonResponse({'success': False, 'message': 'Not logged in.'}, status=401)

    from .models import StockIn
    records = StockIn.objects.all().order_by('-date_received').select_related('product_id', 'received_by')
    result  = []
    for r in records:
        result.append({
            'stock_in_id':      str(r.stock_in_id),
            'product_name':     r.product_id.name,
            'quantity':         r.quantity,
            'unit':             r.unit,
            'supplier':         r.supplier,
            'date_received':    r.date_received.isoformat() if r.date_received else None,
            'received_by_name': r.received_by.username if r.received_by else None,
            'notes':            r.notes,
        })
    return JsonResponse({'success': True, 'records': result})


def api_stock_in_add(request):
    if request.method == 'POST':
        if not is_logged_in(request):
            return JsonResponse({'success': False, 'message': 'Not logged in.'}, status=401)

        from .models import StockIn
        data          = json.loads(request.body)
        product_id    = data.get('product_id')
        quantity      = int(data.get('quantity', 0))

        if not product_id or quantity < 1:
            return JsonResponse({'success': False, 'message': 'Invalid product or quantity.'})

        try:
            product = Product.objects.get(product_id=product_id)
            StockIn.objects.create(
                product_id    = product,
                quantity      = quantity,
                unit          = data.get('unit', ''),
                supplier      = data.get('supplier', ''),
                date_received = data.get('date_received') or timezone.now(),
                received_by   = User.objects.get(user_id=request.session.get('user_id')),
                notes         = data.get('notes', ''),
            )
            product.stock += quantity
            product.save()
            return JsonResponse({
                'success': True,
                'message': f'Stock In recorded. {product.name} stock updated to {product.stock}.'
            })
        except Product.DoesNotExist:
            return JsonResponse({'success': False, 'message': 'Product not found.'})
        except Exception as e:
            return JsonResponse({'success': False, 'message': str(e)})


# ========================
# STOCK OUT APIs
# ========================
def api_stock_out_list(request):
    if not is_logged_in(request):
        return JsonResponse({'success': False, 'message': 'Not logged in.'}, status=401)

    from .models import StockOut
    records = StockOut.objects.all().order_by('-date').select_related('product_id', 'recorded_by')
    result  = []
    for r in records:
        try:
            result.append({
                'stock_out_id':     str(r.stock_out_id),
                'product_name':     r.product_id.name,
                'quantity':         r.quantity,
                'reason':           r.reason,
                'date':             r.date.isoformat() if r.date else None,
                'recorded_by_name': r.recorded_by.username if r.recorded_by else None,
                'notes':            r.notes,
                'unit':             r.product_id.unit if r.product_id else None,
            })
        except Exception:
            continue
    return JsonResponse({'success': True, 'records': result})


def api_stock_out_add(request):
    if request.method == 'POST':
        if not is_logged_in(request):
            return JsonResponse({'success': False, 'message': 'Not logged in.'}, status=401)

        from .models import StockOut
        data       = json.loads(request.body)
        product_id = data.get('product_id')
        quantity   = int(data.get('quantity', 0))

        if not product_id or quantity < 1:
            return JsonResponse({'success': False, 'message': 'Invalid product or quantity.'})

        try:
            product = Product.objects.get(product_id=product_id)
            if product.stock < quantity:
                return JsonResponse({'success': False, 'message': 'Not enough stock.'})

            StockOut.objects.create(
                product_id  = product,
                quantity    = quantity,
                reason      = data.get('reason', 'damaged'),
                recorded_by = User.objects.get(user_id=request.session.get('user_id')),
                notes       = data.get('notes', ''),
            )
            product.stock -= quantity
            product.save()
            return JsonResponse({
                'success': True,
                'message': f'Stock Out recorded. {product.name} stock updated to {product.stock}.'
            })
        except Product.DoesNotExist:
            return JsonResponse({'success': False, 'message': 'Product not found.'})
        except Exception as e:
            return JsonResponse({'success': False, 'message': str(e)})


# ========================
# DASHBOARD APIs
# ========================
def api_dashboard_stats(request):
    if not is_logged_in(request):
        return JsonResponse({'success': False, 'message': 'Not logged in.'}, status=401)

    total_products = Product.objects.count()
    
    # Out of Stock: products with stock = 0
    out_of_stock = Product.objects.filter(stock=0).count()
    
    # Low Stock: products with stock > 0 AND stock <= reorder_level
    low_stock = Product.objects.filter(stock__gt=0, stock__lte=F('reorder_level')).count()
    
    total_transactions = Transaction.objects.count()
    today_sales = Transaction.objects.filter(
        date__date=date.today()
    ).aggregate(total=Sum('total'))['total'] or 0

    return JsonResponse({
        'success': True,
        'total_products': total_products,
        'out_of_stock': out_of_stock,      # ← Add this
        'low_stock': low_stock,            # ← Fixed (excludes out of stock)
        'total_transactions': total_transactions,
        'today_sales': float(today_sales),
    })
def api_dashboard_stats(request):
    if not is_logged_in(request):
        return JsonResponse({'success': False, 'message': 'Not logged in.'}, status=401)

    total_products     = Product.objects.count()
    low_stock          = Product.objects.filter(stock__lte=F('reorder_level')).count()
    total_transactions = Transaction.objects.count()
    today_sales        = Transaction.objects.filter(
        date__date=date.today()
    ).aggregate(total=Sum('total'))['total'] or 0

    return JsonResponse({
        'success':            True,
        'total_products':     total_products,
        'low_stock':          low_stock,
        'total_transactions': total_transactions,
        'today_sales':        float(today_sales),
    })


def api_dashboard_charts(request):
    if not is_logged_in(request):
        return JsonResponse({'success': False, 'message': 'Not logged in.'}, status=401)

    today          = date.today()
    selected_month = int(request.GET.get('month', today.month))
    selected_year  = today.year

    weekly = []
    for i in range(6, -1, -1):
        day   = today - timedelta(days=i)
        total = Transaction.objects.filter(
            date__date=day
        ).aggregate(total=Sum('total'))['total'] or 0
        weekly.append({'label': day.strftime('%a'), 'total': float(total)})

    days_in_month = calendar.monthrange(selected_year, selected_month)[1]
    monthly = []
    for d in range(1, days_in_month + 1):
        total = Transaction.objects.filter(
            date__year=selected_year,
            date__month=selected_month,
            date__day=d,
        ).aggregate(total=Sum('total'))['total'] or 0
        monthly.append({'day': d, 'total': float(total)})

    return JsonResponse({
        'success':       True,
        'weekly':        weekly,
        'monthly':       monthly,
        'current_month': today.month - 1,
    })


# ========================
# USER APIs
# ========================
def api_users_list(request):
    if not is_logged_in(request) or not is_admin(request):
        return JsonResponse({'success': False, 'message': 'Unauthorized.'}, status=403)

    users = User.objects.all().values(
        'user_id', 'username', 'email', 'role', 'is_verified', 'created_at'
    )
    return JsonResponse({'success': True, 'users': list(users)})


def api_users_add(request):
    if request.method == 'POST':
        if not is_logged_in(request) or not is_admin(request):
            return JsonResponse({'success': False, 'message': 'Unauthorized.'}, status=403)

        data     = json.loads(request.body)
        username = data.get('username', '').strip()
        password = data.get('password', '')
        email    = data.get('email', '').strip()
        role     = data.get('role', 'staff')

        if not username or not email:
            return JsonResponse({'success': False, 'message': 'Username and email are required.'})
        if User.objects.filter(username=username).exists():
            return JsonResponse({'success': False, 'message': 'Username already taken.'})
        if User.objects.filter(email=email).exists():
            return JsonResponse({'success': False, 'message': 'Email already registered.'})

        user = User.objects.create(
            username    = username,
            password    = hash_password(password) if password else '',
            email       = email,
            role        = role,
            is_verified = False,
        )

        # Send email in background so it doesn't block/timeout
        thread = threading.Thread(
            target=send_verification_email,
            args=(user, request),
            kwargs={'password_plain': password}
        )
        thread.daemon = True
        thread.start()

        return JsonResponse({'success': True, 'message': f'User created! Verification email sent to {email}.'})
def api_users_edit(request, user_id):
    if request.method == 'POST':
        if not is_logged_in(request) or not is_admin(request):
            return JsonResponse({'success': False, 'message': 'Unauthorized.'}, status=403)

        data = json.loads(request.body)
        try:
            user      = User.objects.get(user_id=user_id)
            user.role = data.get('role', user.role)
            if data.get('password'):
                user.password = hash_password(data['password'])
            user.save()
            return JsonResponse({'success': True})
        except User.DoesNotExist:
            return JsonResponse({'success': False, 'message': 'User not found.'})


def api_users_delete(request, user_id):
    if request.method == 'POST':
        if not is_logged_in(request) or not is_admin(request):
            return JsonResponse({'success': False, 'message': 'Unauthorized.'}, status=403)

        try:
            user = User.objects.get(user_id=user_id)
            if str(user.user_id) == request.session.get('user_id'):
                return JsonResponse({'success': False, 'message': "You can't delete yourself."})
            user.delete()
            return JsonResponse({'success': True})
        except User.DoesNotExist:
            return JsonResponse({'success': False, 'message': 'User not found.'})




# ========================
# TRANSACTION APIs
# ========================
def api_checkout(request):
    if request.method == 'POST':
        if not is_logged_in(request):
            return JsonResponse({'success': False, 'message': 'Not logged in.'}, status=401)

        data  = json.loads(request.body)
        items = data.get('items', [])
        total = data.get('total', 0)

        try:
            user        = User.objects.get(user_id=request.session['user_id'])
            transaction = Transaction.objects.create(total=total, user_id=user)

            for item in items:
                product = Product.objects.get(product_id=item['product_id'])
                TransactionItem.objects.create(
                    transaction_id = transaction,
                    product_id     = product,
                    quantity       = item['quantity'],
                    price          = item['price'],
                )
                product.stock -= item['quantity']
                product.save()

            return JsonResponse({'success': True})
        except Exception as e:
            return JsonResponse({'success': False, 'message': str(e)})


def api_transactions_list(request):
    if not is_logged_in(request):
        return JsonResponse({'success': False, 'message': 'Not logged in.'}, status=401)
    if not is_admin(request):  # ← add this
        return JsonResponse({'success': False, 'message': 'Access denied.'}, status=403)


    filterDate = request.GET.get('date', '')
    searchId   = request.GET.get('search', '').lower()

    transactions = Transaction.objects.all().order_by('-date')
    if filterDate:
        transactions = transactions.filter(date__date=filterDate)

    results = []
    for t in transactions:
        items     = TransactionItem.objects.filter(transaction_id=t).select_related('product_id')
        item_list = [{'name': i.product_id.name, 'qty': i.quantity, 'price': float(i.price)} for i in items]
        short_id  = str(t.transaction_id)[:8].upper()
        if searchId and searchId not in short_id.lower():
            continue
        results.append({
            'transaction_id': str(t.transaction_id),
            'short_id':       short_id,
            'date':           t.date.isoformat(),
            'total':          float(t.total),
            'items':          item_list,
        })

    return JsonResponse({'success': True, 'transactions': results})


# ========================
# REPORTS APIs
# ========================
def api_reports_sales(request):
    if not is_logged_in(request) or not is_admin(request):
        return JsonResponse({'success': False, 'message': 'Unauthorized.'}, status=403)

    transactions = Transaction.objects.all()
    total_sales  = transactions.aggregate(total=Sum('total'))['total'] or 0
    total_trans  = transactions.count()
    avg_sale     = float(total_sales) / total_trans if total_trans else 0

    items       = TransactionItem.objects.all().select_related('product_id')
    product_map = {}
    for item in items:
        name = item.product_id.name
        if name not in product_map:
            product_map[name] = {'qty': 0, 'revenue': 0}
        product_map[name]['qty']     += item.quantity
        product_map[name]['revenue'] += float(item.price) * item.quantity

    data = [{'name': k, 'qty': v['qty'], 'revenue': v['revenue']} for k, v in product_map.items()]
    data.sort(key=lambda x: x['qty'], reverse=True)

    return JsonResponse({
        'success':            True,
        'total_sales':        float(total_sales),
        'total_transactions': total_trans,
        'avg_sale':           avg_sale,
        'products':           data[:5],
    })


def api_reports_inventory(request):
    if not is_logged_in(request) or not is_admin(request):
        return JsonResponse({'success': False, 'message': 'Unauthorized.'}, status=403)

    products       = Product.objects.all()
    total_products = products.count()
    total_value    = sum(float(p.price) * p.stock for p in products)
    low_stock      = products.filter(stock__lte=F('reorder_level')).count()

    product_list = [{
        'name':     p.name,
        'category': p.category,
        'price':    float(p.price),
        'stock':    p.stock,
        'total':    float(p.price) * p.stock,
    } for p in products]

    return JsonResponse({
        'success':           True,
        'total_products':    total_products,
        'total_stock_value': total_value,
        'low_stock':         low_stock,
        'products':          product_list,
    })


# ========================
# MOBILE APIs
# ========================
@csrf_exempt
def api_login(request):
    """Mobile login — returns user info + role. No JWT needed for now."""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Method not allowed.'}, status=405)

    try:
        data     = parse_json_body(request)
        username = data.get('username', '').strip()
        password = data.get('password', '')

        user = User.objects.get(username=username)

        if user.password != hash_password(password):
            return JsonResponse({'success': False, 'message': 'Invalid password.'}, status=401)

        if not user.is_verified:
            return JsonResponse({'success': False, 'message': 'Email not verified. Check your inbox.'}, status=403)

        token = create_jwt_token(user)
        return JsonResponse({
            'success':  True,
            'user_id':  str(user.user_id),
            'username': user.username,
            'role':     user.role,
            'token':    token,
        })

    except User.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'User not found.'}, status=404)
    except json.JSONDecodeError as e:
        return JsonResponse({'success': False, 'message': f'Invalid JSON payload: {e.msg}'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@csrf_exempt
def api_mobile_products(request):
    """Mobile: get all products."""
    products = Product.objects.all().values(
        'product_id', 'name', 'category', 'price', 'stock', 'unit', 'reorder_level'
    )
    
    products_list = []
    for p in products:
        products_list.append({
            'product_id': p['product_id'],
            'name': p['name'],
            'category': p['category'],
            'price': float(p['price']) if p['price'] else 0.00,
            'stock': p['stock'],
            'unit': p['unit'] or 'pieces',
            'reorder_level': p['reorder_level'] or 10,
        })
    
    return JsonResponse({'success': True, 'products': products_list})

@csrf_exempt
def api_mobile_product_detail(request, product_id):
    """Mobile: get a single product by ID."""
    if request.method != 'GET':
        return JsonResponse({'success': False, 'message': 'Method not allowed.'}, status=405)

    try:
        product = Product.objects.get(product_id=product_id)
    except Product.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Product not found.'}, status=404)

    data = {
        'product_id':   str(product.product_id),
        'name':         product.name,
        'category':     product.category,
        'price':        float(product.price) if product.price else 0.00,  # ← FIX THIS
        'stock':        product.stock,
        'unit':         product.unit or 'pieces',
        'reorder_level': product.reorder_level or 10,
    }
    return JsonResponse({'success': True, 'product': data})

@csrf_exempt
def api_mobile_products_add(request):
    """Mobile: add a new product (admin only)."""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Method not allowed.'}, status=405)

    user, error = validate_jwt_admin(request)
    if error:
        return error

    try:
        data = parse_json_body(request)
        name = data.get('name', '').strip()
        if not name:
            return JsonResponse({'success': False, 'message': 'Name is required.'})

        product = Product.objects.create(
            name          = name,
            category      = data.get('category', ''),
            unit          = data.get('unit', 'pieces'),
            price         = data.get('price', 0),
            stock         = data.get('stock', 0),
            reorder_level = data.get('reorder_level', 10),
        )
        return JsonResponse({'success': True, 'product_id': str(product.product_id)})
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@csrf_exempt
def api_mobile_products_edit(request, product_id):
    """Mobile: edit a product (admin only)."""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Method not allowed.'}, status=405)

    user, error = validate_jwt_admin(request)
    if error:
        return error

    try:
        data = parse_json_body(request)
        product               = Product.objects.get(product_id=product_id)
        product.name          = data.get('name', product.name)
        product.category      = data.get('category', product.category)
        product.unit          = data.get('unit', product.unit)
        product.price         = data.get('price', product.price)
        product.stock         = data.get('stock', product.stock)
        product.reorder_level = data.get('reorder_level', product.reorder_level)
        product.save()
        return JsonResponse({'success': True})
    except Product.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Product not found.'}, status=404)
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@csrf_exempt
def api_mobile_products_delete(request, product_id):
    """Mobile: delete a product (admin only)."""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Method not allowed.'}, status=405)

    user, error = validate_jwt_admin(request)
    if error:
        return error

    try:
        product = Product.objects.get(product_id=product_id)
        product.delete()
        return JsonResponse({'success': True})
    except Product.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Product not found.'}, status=404)
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


def _unauthorized_json():
    return JsonResponse({'success': False, 'message': 'Unauthorized.'}, status=401)


def require_mobile_auth(func):
    """Decorator to require JWT auth for mobile and web API endpoints.

    Expects header: Authorization: Bearer <token> or cookie: jwt_token.
    Sets `request.mobile_user` to the `User` instance on success.
    """
    def wrapper(request, *args, **kwargs):
        token = get_jwt_from_request(request)
        if not token:
            return JsonResponse({'success': False, 'message': 'Missing Authorization header or jwt_token cookie.'}, status=401)

        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
            user_id = payload.get('user_id')
            if not user_id:
                return _unauthorized_json()
            try:
                user = User.objects.get(user_id=user_id)
                request.mobile_user = user
            except User.DoesNotExist:
                return _unauthorized_json()
        except jwt.ExpiredSignatureError:
            return JsonResponse({'success': False, 'message': 'Token expired.'}, status=401)
        except Exception:
            return _unauthorized_json()

        return func(request, *args, **kwargs)

    wrapper.__name__ = getattr(func, '__name__', 'wrapped')
    return wrapper


@csrf_exempt
def api_mobile_low_stock(request):
    """Mobile: low stock alerts."""
    products = Product.objects.filter(
        stock__lte=F('reorder_level')
    ).values('product_id', 'name', 'category', 'stock', 'reorder_level', 'unit')
    return JsonResponse({'success': True, 'products': list(products)})


@csrf_exempt
def api_mobile_daily_summary(request):
    """Mobile: daily sales summary (admin only)."""
    today              = date.today()
    total_sales        = Transaction.objects.filter(date__date=today).aggregate(total=Sum('total'))['total'] or 0
    
    
    total_transactions = Transaction.objects.count()
    
    low_stock          = Product.objects.filter(stock__lte=F('reorder_level')).count()

    return JsonResponse({
        'success':            True,
        'date':               str(today),
        'total_sales':        float(total_sales),
        'total_transactions': total_transactions,
        'low_stock_alerts':   low_stock,
    })


@csrf_exempt
def api_mobile_stock_in_list(request):
    """Mobile: list stock in records."""
    if request.method != 'GET':
        return JsonResponse({'success': False, 'message': 'Method not allowed.'}, status=405)

    from .models import StockIn
    records = StockIn.objects.all().order_by('-date_received').select_related('product_id', 'received_by')
    result  = []
    for r in records:
        result.append({
            'stock_in_id':      str(r.stock_in_id),
            'product_name':     r.product_id.name if r.product_id else None,
            'quantity':         r.quantity,
            'unit':             r.unit,
            'supplier':         r.supplier,
            'date_received':    r.date_received.isoformat() if r.date_received else None,
            'received_by_name': r.received_by.username if r.received_by else None,
            'notes':            r.notes,
        })
    return JsonResponse({'success': True, 'records': result})


@csrf_exempt
def api_mobile_stock_in_history(request):
    """
    Exempt from login requirements so tokenless requests work fine.
    """
    if request.method != 'GET':
        return JsonResponse({'success': False, 'message': 'Method not allowed.'}, status=405)

    try:
        records = StockIn.objects.all().order_by('-date_received').select_related('product_id', 'received_by')
        record_list = []
        for item in records:
            record_list.append({
                'stock_in_id': str(item.stock_in_id),
                'product_name': item.product_id.name if item.product_id else 'Unknown Product',
                'quantity': item.quantity,
                'unit': item.unit or 'pcs',
                'supplier': item.supplier,
                'date_received': item.date_received.isoformat() if item.date_received else None,
                'received_by_name': item.received_by.username if item.received_by else 'System',
                'notes': item.notes,
            })

        return JsonResponse({
            'success': True,
            'records': record_list
        })

    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': str(e)
        }, status=500)

@csrf_exempt
def api_mobile_stock_out_list(request):
    """Mobile: list stock out records."""
    if request.method != 'GET':
        return JsonResponse({'success': False, 'message': 'Method not allowed.'}, status=405)

    from .models import StockOut
    records = StockOut.objects.all().order_by('-date').select_related('product_id', 'recorded_by')
    result  = []
    for r in records:
        result.append({
            'stock_out_id':     str(r.stock_out_id),
            'product_name':     r.product_id.name if r.product_id else None,
            'quantity':         r.quantity,
            'reason':           r.reason,
            'date':             r.date.isoformat() if r.date else None,
            'recorded_by_name': r.recorded_by.username if r.recorded_by else None,
            'notes':            r.notes,
            'unit':             r.product_id.unit if r.product_id else None,
        })
    return JsonResponse({'success': True, 'records': result})


@csrf_exempt
def api_mobile_transactions(request):
    """Mobile: list recent transactions."""
    if request.method != 'GET':
        return JsonResponse({'success': False, 'message': 'Method not allowed.'}, status=405)

    transactions = Transaction.objects.all().order_by('-date')[:20].select_related('user_id')
    result = []
    for t in transactions:
        result.append({
            'transaction_id': str(t.transaction_id),
            'date':           t.date.isoformat() if t.date else None,
            'total':          float(t.total),
            'username':       t.user_id.username if t.user_id else None,
        })
    return JsonResponse({'success': True, 'transactions': result})

@csrf_exempt
def api_mobile_users_list(request):
    """Mobile: list all users (admin only)."""
    if request.method != 'GET':
        return JsonResponse({'success': False, 'message': 'Method not allowed.'}, status=405)

    user, error = validate_jwt_admin(request)
    if error:
        return error

    users = User.objects.all().values(
        'user_id', 'username', 'email', 'role', 'is_verified', 'created_at'
    )
    return JsonResponse({'success': True, 'users': list(users)})

@csrf_exempt
def api_mobile_users_add(request):
    """Mobile: add a new user (admin only)."""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Method not allowed.'}, status=405)

    user, error = validate_jwt_admin(request)
    if error:
        return error

    data     = json.loads(request.body)
    username = data.get('username', '').strip()
    password = data.get('password', '')
    email    = data.get('email', '').strip()
    role     = data.get('role', 'staff')

    if not username or not email or not password:
        return JsonResponse({'success': False, 'message': 'Username, email and password are required.'})
    if User.objects.filter(username=username).exists():
        return JsonResponse({'success': False, 'message': 'Username already taken.'})
    if User.objects.filter(email=email).exists():
        return JsonResponse({'success': False, 'message': 'Email already registered.'})

    user = User.objects.create(
        username    = username,
        password    = hash_password(password),
        email       = email,
        role        = role,
        is_verified = False,
    )

    thread = threading.Thread(
        target=send_verification_email,
        args=(user, request),
        kwargs={'password_plain': password}
    )
    thread.daemon = True
    thread.start()

    return JsonResponse({'success': True, 'message': f'User created! Verification email sent to {email}.'})


@csrf_exempt
@csrf_exempt
def api_mobile_users_edit(request, user_id):
    """Mobile: edit existing user (admin only)."""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Method not allowed.'}, status=405)

    admin_user, error = validate_jwt_admin(request)
    if error:
        return error

    data = json.loads(request.body)
    try:
        user = User.objects.get(user_id=user_id)
        user.role = data.get('role', user.role)
        if data.get('password'):
            user.password = hash_password(data['password'])
        user.save()
        return JsonResponse({'success': True})
    except User.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'User not found.'})


@csrf_exempt
def api_mobile_users_delete(request, user_id):
    """Mobile: delete a user (admin only)."""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Method not allowed.'}, status=405)

    admin_user, error = validate_jwt_admin(request)
    if error:
        return error

    try:
        user = User.objects.get(user_id=user_id)
        user.delete()
        return JsonResponse({'success': True})
    except User.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'User not found.'})


@csrf_exempt
def api_mobile_stock_in(request):
    """Mobile: record stock in."""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Method not allowed.'}, status=405)

    try:
        from .models import StockIn
        data       = json.loads(request.body)
        product_id = data.get('product_id')
        quantity   = int(data.get('quantity', 0))
        user_id    = data.get('user_id')

        if not product_id or quantity < 1 or not user_id:
            return JsonResponse({'success': False, 'message': 'Invalid request. Product, quantity and user_id are required.'})

        try:
            user = User.objects.get(user_id=user_id)
        except User.DoesNotExist:
            return JsonResponse({'success': False, 'message': 'User not found.'}, status=404)

        product = Product.objects.get(product_id=product_id)

        StockIn.objects.create(
            product_id    = product,
            quantity      = quantity,
            unit          = data.get('unit', ''),
            supplier      = data.get('supplier', ''),
            date_received = data.get('date_received') or timezone.now(),
            received_by   = user,
            notes         = data.get('notes', ''),
        )
        product.stock += quantity
        product.save()
        return JsonResponse({'success': True, 'message': f'{product.name} stock updated to {product.stock}.'})
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)})


@csrf_exempt
def api_mobile_stock_out(request):
    """Mobile: record stock out."""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Method not allowed.'}, status=405)

    try:
        from .models import StockOut
        data       = json.loads(request.body)
        product_id = data.get('product_id')
        quantity   = int(data.get('quantity', 0))
        user_id    = data.get('user_id')

        if not product_id or quantity < 1 or not user_id:
            return JsonResponse({'success': False, 'message': 'Invalid request. Product, quantity and user_id are required.'})

        try:
            user = User.objects.get(user_id=user_id)
        except User.DoesNotExist:
            return JsonResponse({'success': False, 'message': 'User not found.'}, status=404)

        product = Product.objects.get(product_id=product_id)

        if product.stock < quantity:
            return JsonResponse({'success': False, 'message': 'Not enough stock.'})

        StockOut.objects.create(
            product_id  = product,
            quantity    = quantity,
            reason      = data.get('reason', 'damaged'),
            recorded_by = user,
            notes       = data.get('notes', ''),
        )
        product.stock -= quantity
        product.save()
        return JsonResponse({'success': True, 'message': f'{product.name} stock updated to {product.stock}.'})
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)})


@csrf_exempt
def api_mobile_checkout(request):
    """Mobile: process a sale."""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Method not allowed.'}, status=405)

    try:
        data    = json.loads(request.body)
        items   = data.get('items', [])
        total   = data.get('total', 0)
        user_id = data.get('user_id')

        if not user_id:
            return JsonResponse({'success': False, 'message': 'Invalid request. user_id is required.'})

        try:
            user = User.objects.get(user_id=user_id)
        except User.DoesNotExist:
            return JsonResponse({'success': False, 'message': 'User not found.'}, status=404)

        transaction = Transaction.objects.create(total=total, user_id=user)

        for item in items:
            product = Product.objects.get(product_id=item['product_id'])
            TransactionItem.objects.create(
                transaction_id = transaction,
                product_id     = product,
                quantity       = item['quantity'],
                price          = item['price'],
            )
            product.stock -= item['quantity']
            product.save()

        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)})


@csrf_exempt
def api_mobile_charts(request):
    """Mobile: charts data — no session required, works without JWT."""
    today          = date.today()
    selected_month = int(request.GET.get('month', today.month))
    selected_year  = today.year
 
    # Weekly: last 7 days
    weekly = []
    for i in range(6, -1, -1):
        day   = today - timedelta(days=i)
        total = Transaction.objects.filter(
            date__date=day
        ).aggregate(total=Sum('total'))['total'] or 0
        weekly.append({'label': day.strftime('%a'), 'total': float(total)})
 
    # Monthly: ALL days in the selected month (including zeros)
    days_in_month = calendar.monthrange(selected_year, selected_month)[1]
    monthly = []
    for d in range(1, days_in_month + 1):
        total = Transaction.objects.filter(
            date__year=selected_year,
            date__month=selected_month,
            date__day=d,
        ).aggregate(total=Sum('total'))['total'] or 0
        monthly.append({'day': d, 'total': float(total)})
 
    return JsonResponse({
        'success':       True,
        'weekly':        weekly,
        'monthly':       monthly,
        'current_month': today.month - 1,
    })