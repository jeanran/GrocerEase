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

import hashlib
import json
import secrets
from datetime import date, timedelta
import calendar
import threading

from .models import User, Product, Transaction, TransactionItem


# ========================
# UTILITIES
# ========================
def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()


def is_logged_in(request):
    return 'user_id' in request.session


def is_admin(request):
    return request.session.get('role') == 'admin'


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
    return render(request, 'stock_in_history.html', {
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
# DASHBOARD APIs
# ========================
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
        data     = json.loads(request.body)
        username = data.get('username', '').strip()
        password = data.get('password', '')

        user = User.objects.get(username=username)

        if user.password != hash_password(password):
            return JsonResponse({'success': False, 'message': 'Invalid password.'}, status=401)

        if not user.is_verified:
            return JsonResponse({'success': False, 'message': 'Email not verified. Check your inbox.'}, status=403)

        return JsonResponse({
            'success':  True,
            'user_id':  str(user.user_id),
            'username': user.username,
            'role':     user.role,
        })

    except User.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'User not found.'}, status=404)
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@csrf_exempt
def api_mobile_products(request):
    """Mobile: get all products."""
    products = Product.objects.all().values(
        'product_id', 'name', 'category', 'price', 'stock', 'unit', 'reorder_level'
    )
    return JsonResponse({'success': True, 'products': list(products)})


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
    total_transactions = Transaction.objects.filter(date__date=today).count()
    low_stock          = Product.objects.filter(stock__lte=F('reorder_level')).count()

    return JsonResponse({
        'success':            True,
        'date':               str(today),
        'total_sales':        float(total_sales),
        'total_transactions': total_transactions,
        'low_stock_alerts':   low_stock,
    })


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

        product = Product.objects.get(product_id=product_id)
        user    = User.objects.get(user_id=user_id)

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

        product = Product.objects.get(product_id=product_id)
        user    = User.objects.get(user_id=user_id)

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

        user        = User.objects.get(user_id=user_id)
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
