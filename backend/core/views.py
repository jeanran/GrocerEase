# ============================================================
# core/views.py — GrocerEase
# ============================================================

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
from django.db.models import Sum

from rest_framework.decorators import api_view, permission_classes

from rest_framework.permissions import AllowAny, IsAuthenticated  

import hashlib
import json
import secrets
from datetime import date, timedelta
import calendar

from .models import User, Product, Transaction, TransactionItem


# ========================
# UTILITIES
# ========================
def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def is_logged_in(request):
    return 'user_id' in request.session


# ========================
# EMAIL VERIFICATION
# ========================
def send_verification_email(user, request):
    token = secrets.token_urlsafe(32)
    user.verification_token = token
    user.save()

    scheme     = 'https' if request.is_secure() else 'http'
    host       = request.get_host()
    verify_url = f"{scheme}://{host}/verify/{token}/"

    send_mail(
        subject='Activate your GrocerEase Account',
        message=f"""
Hello {user.username},

Your GrocerEase staff account has been created by the Admin.

Please click the link below to verify your email and activate your account:

{verify_url}

Once verified, you can log in using your username and password.

If you did not expect this email, please ignore it.

— GrocerEase System
        """,
        from_email=settings.EMAIL_HOST_USER,
        recipient_list=[user.email],
        fail_silently=False,
    )


def verify_email(request, token):
    try:
        user = User.objects.get(verification_token=token)
        user.is_verified        = True
        user.verification_token = None
        user.save()
        messages.success(request,
            f'Account verified successfully! You can now log in, {user.username}.')
        return redirect('login')
    except User.DoesNotExist:
        messages.error(request,
            'Invalid or expired verification link. Please contact your admin.')
        return redirect('login')


# ========================
# AUTHENTICATION VIEWS
# ========================


def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def login_view(request):
    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        password = request.POST.get('password', '')

        try:
            user = User.objects.get(username=username)
            
            # Check password
            if user.password == hash_password(password):
                # Check if verified
                if not user.is_verified:
                    messages.error(request, 'Please verify your email first. Check your inbox.')
                    return render(request, 'auth/login.html')
                
                # Set session
                request.session['user_id'] = str(user.user_id)
                request.session['username'] = user.username
                request.session['role'] = user.role
                
                # Redirect
                if user.role == 'admin':
                    return redirect('dashboard')
                else:
                    return redirect('pos')
            else:
                messages.error(request, 'Invalid password.')
                
        except User.DoesNotExist:
            messages.error(request, 'User not found.')
    
    return render(request, 'auth/login.html')


def logout_view(request):
    request.session.flush()
    return redirect('login')


# ========================
# PAGE VIEWS
# ========================


def dashboard(request):
    if not is_logged_in(request):
        return redirect('login')
    # Admin only
    if request.session.get('role') != 'admin':
        return redirect('stocks')
    return render(request, 'dashboard.html', {
        'username': request.session.get('username'),
        'role':     request.session.get('role'),
    })



def products(request):
    if not is_logged_in(request):
        return redirect('login')
    return render(request, 'products.html', {
        'username': request.session.get('username'),
        'role': request.session.get('role'),
    })

def stock_in(request):
    if not is_logged_in(request):
        return redirect('login')
    return render(request, 'stock_in.html', {
        'username': request.session.get('username'),
        'role':     request.session.get('role'),
    })


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
    # Admin only
    if request.session.get('role') != 'admin':
        return redirect('stocks')
    return render(request, 'reports.html', {
        'username': request.session.get('username'),
        'role':     request.session.get('role'),
    })


def manage_users(request):
    if not is_logged_in(request):
        return redirect('login')
    # Admin only
    if request.session.get('role') != 'admin':
        return redirect('stocks')
    return render(request, 'users.html', {
        'username': request.session.get('username'),
        'role':     request.session.get('role'),
    })


# ========================
# DASHBOARD APIs
# ========================
def api_dashboard_stats(request):
    total_products = Product.objects.count()
    low_stock = Product.objects.filter(stock__lte=5).count()
    total_transactions = Transaction.objects.count()

    today_sales = Transaction.objects.filter(
        date__date=date.today()
    ).aggregate(total=Sum('total'))['total'] or 0

    return JsonResponse({
        'success': True,
        'total_products': total_products,
        'low_stock': low_stock,
        'total_transactions': total_transactions,
        'today_sales': float(today_sales),
    })


def api_dashboard_charts(request):
    today = date.today()
    selected_month = int(request.GET.get('month', today.month))
    selected_year = today.year

    weekly = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
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
            date__day=d
        ).aggregate(total=Sum('total'))['total'] or 0
        monthly.append({'day': d, 'total': float(total)})

    return JsonResponse({
        'success': True,
        'weekly': weekly,
        'monthly': monthly,
        'current_month': today.month - 1,
    })


# ========================
# USER APIs
# ========================
def api_users_list(request):
    users = User.objects.all().values('user_id', 'username', 'role', 'created_at')
    return JsonResponse({'success': True, 'users': list(users)})





def api_users_edit(request, user_id):
    if request.method == 'POST':
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


def api_users_delete(request, user_id):
    if request.method == 'POST':
        try:
            user = User.objects.get(user_id=user_id)
            if str(user.user_id) == request.session.get('user_id'):
                return JsonResponse({'success': False, 'message': "You can't delete yourself."})
            user.delete()
            return JsonResponse({'success': True})
        except User.DoesNotExist:
            return JsonResponse({'success': False, 'message': 'User not found.'})
def send_verification_email(user, request):
    token      = secrets.token_urlsafe(32)
    user.verification_token = token
    user.save()

    verify_url = f"http://{request.get_host()}/verify/{token}/"

    send_mail(
        subject='Verify your GrocerEase Account',
        message=f'''
Hi {user.username},

Welcome to GrocerEase! Please verify your email address by clicking the link below:

{verify_url}

If you did not create this account, you can ignore this email.

GrocerEase Team
        ''',
        from_email=settings.EMAIL_HOST_USER,
        recipient_list=[user.email],
        fail_silently=False,
    )


# ── Web: Add user (from Manage Users page) ──
def api_users_add(request):
    if request.method == 'POST':
        data     = json.loads(request.body)
        username = data.get('username', '').strip()
        password = data.get('password', '')
        email    = data.get('email', '').strip()
        role     = data.get('role', 'admin')

        if User.objects.filter(username=username).exists():
            return JsonResponse({'success': False, 'message': 'Username already taken.'})

        if User.objects.filter(email=email).exists():
            return JsonResponse({'success': False, 'message': 'Email already registered.'})

        user = User.objects.create(
            username=username,
            password=hash_password(password),
            email=email,
            role=role,
            is_verified=False
        )

        try:
            send_verification_email(user, request)
            return JsonResponse({'success': True, 'message': f'User created! Verification email sent to {email}.'})
        except Exception as e:
            return JsonResponse({'success': True, 'message': f'User created but email failed: {str(e)}'})


# ── Verify email ──
def verify_email(request, token):
    try:
        user = User.objects.get(verification_token=token)
        user.is_verified        = True
        user.verification_token = None
        user.save()
        messages.success(request, 'Email verified successfully! You can now log in.')
        return redirect('login')
    except User.DoesNotExist:
        messages.error(request, 'Invalid or expired verification link.')
        return redirect('login')


# ========================
# PRODUCT APIs
# ========================
def api_products_list(request):
    products = Product.objects.all().values(
        'product_id', 'name', 'category', 'price', 'stock', 'unit', 'reorder_level'
    )
    return JsonResponse({'success': True, 'products': list(products)})


def api_products_add(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        name = data.get('name', '').strip()

        if not name:
            return JsonResponse({'success': False, 'message': 'Name is required.'})

        product = Product.objects.create(
            name=name,
            category=data.get('category', ''),
            unit=data.get('unit', 'pieces'),
            price=data.get('price', 0),
            stock=data.get('stock', 0),
            reorder_level=data.get('reorder_level', 10),
        )
        return JsonResponse({'success': True, 'product_id': str(product.product_id)})


def api_products_edit(request, product_id):
    if request.method == 'POST':
        data = json.loads(request.body)
        try:
            product = Product.objects.get(product_id=product_id)
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
        try:
            Product.objects.get(product_id=product_id).delete()
            return JsonResponse({'success': True})
        except Product.DoesNotExist:
            return JsonResponse({'success': False, 'message': 'Product not found.'})


# ========================
# STOCK IN APIs
# ========================
def api_stock_in_list(request):
    from .models import StockIn
    records = StockIn.objects.all().order_by('-date_received').select_related('product_id', 'received_by')

    result = []
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
        from .models import StockIn
        data          = json.loads(request.body)
        product_id    = data.get('product_id')
        quantity      = int(data.get('quantity', 0))
        unit          = data.get('unit', '')
        supplier      = data.get('supplier', '')
        date_received = data.get('date_received')
        notes         = data.get('notes', '')

        if not product_id or quantity < 1:
            return JsonResponse({'success': False, 'message': 'Invalid product or quantity.'})

        try:
            product = Product.objects.get(product_id=product_id)

            StockIn.objects.create(
                product_id    = product,
                quantity      = quantity,
                unit          = unit,
                supplier      = supplier,
                date_received = date_received,
                received_by   = User.objects.get(user_id=request.session.get('user_id')),
                notes         = notes,
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
    from .models import StockOut
    records = StockOut.objects.all().order_by('-date').select_related('product_id', 'recorded_by')

    result = []
    for r in records:
        result.append({
            'stock_out_id':     str(r.stock_out_id),
            'product_name':     r.product_id.name,
            'quantity':         r.quantity,
            'reason':           r.reason,
            'date':             r.date.isoformat() if r.date else None,
            'recorded_by_name': r.recorded_by.username if r.recorded_by else None,
            'notes':            r.notes,
        })
    return JsonResponse({'success': True, 'records': result})


def api_stock_out_add(request):
    if request.method == 'POST':
        from .models import StockOut
        data       = json.loads(request.body)
        product_id = data.get('product_id')
        quantity   = int(data.get('quantity', 0))
        reason     = data.get('reason', 'damaged')
        notes      = data.get('notes', '')

        if not product_id or quantity < 1:
            return JsonResponse({'success': False, 'message': 'Invalid product or quantity.'})

        try:
            product = Product.objects.get(product_id=product_id)

            if product.stock < quantity:
                return JsonResponse({'success': False, 'message': 'Not enough stock.'})

            StockOut.objects.create(
                product_id  = product,
                quantity    = quantity,
                reason      = reason,
                recorded_by = User.objects.get(user_id=request.session.get('user_id')),
                notes       = notes,
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
# POS / CHECKOUT API
# ========================
def api_checkout(request):
    if request.method == 'POST':
        if not is_logged_in(request):
            return JsonResponse({'success': False, 'message': 'Not logged in.'})

        data  = json.loads(request.body)
        items = data.get('items', [])
        total = data.get('total', 0)

        try:
            user        = User.objects.get(user_id=request.session['user_id'])
            transaction = Transaction.objects.create(total=total, user_id=user)

            for item in items:
                product = Product.objects.get(product_id=item['product_id'])
                TransactionItem.objects.create(
                    transaction_id=transaction,
                    product_id=product,
                    quantity=item['quantity'],
                    price=item['price']
                )
                product.stock -= item['quantity']
                product.save()

            return JsonResponse({'success': True})

        except Exception as e:
            return JsonResponse({'success': False, 'message': str(e)})


def api_transactions_list(request):
    filterDate = request.GET.get('date', '')
    searchId   = request.GET.get('search', '').lower()

    transactions = Transaction.objects.all().order_by('-date')
    if filterDate:
        transactions = transactions.filter(date__date=filterDate)

    results = []
    for t in transactions:
        items = TransactionItem.objects.filter(
            transaction_id=t
        ).select_related('product_id')

        item_list = [{
            'name':  item.product_id.name,
            'qty':   item.quantity,
            'price': float(item.price),
        } for item in items]

        short_id = str(t.transaction_id)[:8].upper()
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

    data = [{'name': k, 'qty': v['qty'], 'revenue': v['revenue']}
            for k, v in product_map.items()]
    data.sort(key=lambda x: x['qty'], reverse=True)

    return JsonResponse({
        'success':            True,
        'total_sales':        float(total_sales),
        'total_transactions': total_trans,
        'avg_sale':           avg_sale,
        'products':           data[:5],
    })


def api_reports_inventory(request):
    products      = Product.objects.all()
    total_products = products.count()
    total_value   = sum(float(p.price) * p.stock for p in products)
    low_stock     = products.filter(stock__lte=5).count()

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

# ── WEB LOGIN (Django templates — stays the same) ──
def login_view(request):
    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        password = request.POST.get('password', '')
        try:
            user = User.objects.get(username=username)
            if user.password == hash_password(password):
                if not user.is_verified:
                    messages.error(request, 'Please verify your email before logging in. Check your inbox.')
                    return render(request, 'auth/login.html')
                request.session['user_id']  = str(user.user_id)
                request.session['username'] = user.username
                request.session['role']     = user.role
                return redirect('dashboard')
            else:
                messages.error(request, 'Invalid password.')
        except User.DoesNotExist:
            messages.error(request, 'User not found.')
    return render(request, 'auth/login.html')


# ── API LOGIN (for mobile — returns JWT) ──
@api_view(['POST'])
@permission_classes([AllowAny])
def api_login(request):
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '')

    try:
        user = User.objects.get(username=username)
        if user.password == hash_password(password):
            if not user.is_verified:
                return Response({
                    'success': False,
                    'message': 'Email not verified. Please check your inbox.'
                }, status=status.HTTP_403_FORBIDDEN)

            tokens = get_tokens_for_user(user)
            return Response({
                'success':  True,
                'user_id':  str(user.user_id),
                'username': user.username,
                'role':     user.role,
                'access':   tokens['access'],
                'refresh':  tokens['refresh'],
            })
        return Response({'success': False, 'message': 'Invalid password.'}, status=status.HTTP_401_UNAUTHORIZED)
    except User.DoesNotExist:
        return Response({'success': False, 'message': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)@csrf_exempt



@csrf_exempt
def api_mobile_products(request):
    products = Product.objects.filter(stock__gt=0).values(
        'product_id', 'name', 'category', 'price', 'stock'
    )
    return JsonResponse({'success': True, 'products': list(products)})


@csrf_exempt
def api_mobile_checkout(request):
    if request.method == 'POST':
        data    = json.loads(request.body)
        items   = data.get('items', [])
        total   = data.get('total', 0)
        user_id = data.get('user_id')

        try:
            user        = User.objects.get(user_id=user_id)
            transaction = Transaction.objects.create(total=total, user_id=user)

            for item in items:
                product = Product.objects.get(product_id=item['product_id'])
                TransactionItem.objects.create(
                    transaction_id=transaction,
                    product_id=product,
                    quantity=item['quantity'],
                    price=item['price']
                )
                product.stock -= item['quantity']
                product.save()

            return JsonResponse({'success': True})
        except Exception as e:
            return JsonResponse({'success': False, 'message': str(e)})
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_mobile_products(request):
    products = Product.objects.filter(stock__gt=0).values(
        'product_id', 'name', 'category', 'price', 'stock'
    )
    return Response({'success': True, 'products': list(products)})