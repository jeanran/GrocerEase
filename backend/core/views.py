# ========================
# IMPORTS
# ========================
from django.shortcuts import render, redirect
from django.http import JsonResponse
from django.contrib import messages
from django.utils import timezone
from django.db.models import Sum

import hashlib
import json
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


def require_login(request):
    if not is_logged_in(request):
        return redirect('login')
    return None


# ========================
# AUTHENTICATION VIEWS
# ========================
def login_view(request):
    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        password = request.POST.get('password', '')

        try:
            user = User.objects.get(username=username)
            if user.password == hash_password(password):
                request.session['user_id'] = str(user.user_id)
                request.session['username'] = user.username
                request.session['role'] = user.role

                return redirect('dashboard' if user.role == 'admin' else 'pos')
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

    return render(request, 'dashboard.html', {
        'username': request.session.get('username'),
        'role': request.session.get('role')
    })


def pos(request):
    if not is_logged_in(request):
        return redirect('login')

    return render(request, 'pos.html', {
        'username': request.session.get('username')
    })


def products(request):
    if not is_logged_in(request):
        return redirect('login')
    return render(request, 'products.html')


def orders(request):
    if not is_logged_in(request):
        return redirect('login')
    return render(request, 'orders.html')


def reports(request):
    if not is_logged_in(request):
        return redirect('login')
    return render(request, 'reports.html')


def manage_users(request):
    if not is_logged_in(request):
        return redirect('login')

    if request.session.get('role') != 'admin':
        return redirect('dashboard')

    return render(request, 'users.html', {
        'username': request.session.get('username'),
        'role': request.session.get('role'),
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

    # Weekly
    weekly = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        total = Transaction.objects.filter(
            date__date=day
        ).aggregate(total=Sum('total'))['total'] or 0

        weekly.append({
            'label': day.strftime('%a'),
            'total': float(total)
        })

    # Monthly
    days_in_month = calendar.monthrange(selected_year, selected_month)[1]
    monthly = []

    for d in range(1, days_in_month + 1):
        total = Transaction.objects.filter(
            date__year=selected_year,
            date__month=selected_month,
            date__day=d
        ).aggregate(total=Sum('total'))['total'] or 0

        monthly.append({
            'day': d,
            'total': float(total)
        })

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


def api_users_add(request):
    if request.method == 'POST':
        data = json.loads(request.body)

        username = data.get('username', '').strip()
        password = data.get('password', '')
        role = data.get('role', 'cashier')

        if User.objects.filter(username=username).exists():
            return JsonResponse({'success': False, 'message': 'Username already taken.'})

        User.objects.create(
            username=username,
            password=hash_password(password),
            role=role
        )

        return JsonResponse({'success': True})


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
                return JsonResponse({
                    'success': False,
                    'message': "You can't delete yourself."
                })

            user.delete()
            return JsonResponse({'success': True})

        except User.DoesNotExist:
            return JsonResponse({'success': False, 'message': 'User not found.'})


# ========================
# PRODUCT APIs
# ========================
def api_products_list(request):
    products = Product.objects.all().values(
        'product_id', 'name', 'category', 'price', 'stock'
    )
    return JsonResponse({'success': True, 'products': list(products)})


def api_products_add(request):
    if request.method == 'POST':
        data = json.loads(request.body)

        name = data.get('name', '').strip()
        category = data.get('category', '')
        price = data.get('price', 0)
        stock = data.get('stock', 0)

        if not name:
            return JsonResponse({'success': False, 'message': 'Name is required.'})

        product = Product.objects.create(
            name=name,
            category=category,
            price=price,
            stock=stock
        )

        return JsonResponse({
            'success': True,
            'product_id': str(product.product_id)
        })


def api_products_edit(request, product_id):
    if request.method == 'POST':
        data = json.loads(request.body)

        try:
            product = Product.objects.get(product_id=product_id)

            product.name = data.get('name', product.name)
            product.category = data.get('category', product.category)
            product.price = data.get('price', product.price)
            product.stock = data.get('stock', product.stock)

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
# POS / CHECKOUT API
# ========================
def api_checkout(request):
    if request.method == 'POST':
        if not is_logged_in(request):
            return JsonResponse({'success': False, 'message': 'Not logged in.'})

        data = json.loads(request.body)
        items = data.get('items', [])
        total = data.get('total', 0)

        try:
            user = User.objects.get(user_id=request.session['user_id'])

            transaction = Transaction.objects.create(
                total=total,
                user_id=user
            )

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
    searchId = request.GET.get('search', '').lower()

    transactions = Transaction.objects.all().order_by('-date')

    if filterDate:
        transactions = transactions.filter(date__date=filterDate)

    results = []
    for t in transactions:
        items = TransactionItem.objects.filter(
            transaction_id=t
        ).select_related('product_id')

        item_list = [{
            'name': item.product_id.name,
            'qty': item.quantity,
            'price': float(item.price),
        } for item in items]

        short_id = str(t.transaction_id)[:8].upper()

        if searchId and searchId not in short_id.lower():
            continue

        results.append({
            'transaction_id': str(t.transaction_id),
            'short_id': short_id,
            'date': t.date.isoformat(),
            'total': float(t.total),
            'items': item_list,
        })

    return JsonResponse({'success': True, 'transactions': results})


def api_reports_sales(request):
    transactions = Transaction.objects.all()
    total_sales = transactions.aggregate(total=Sum('total'))['total'] or 0
    total_trans = transactions.count()
    avg_sale = float(total_sales) / total_trans if total_trans else 0

    # Product-based sales from transaction items
    items = TransactionItem.objects.all().select_related('product_id')
    product_map = {}
    for item in items:
        name = item.product_id.name
        if name not in product_map:
            product_map[name] = {'qty': 0, 'revenue': 0}
        product_map[name]['qty'] += item.quantity
        product_map[name]['revenue'] += float(item.price) * item.quantity

    data = [{'name': k, 'qty': v['qty'], 'revenue': v['revenue']}
            for k, v in product_map.items()]
    data.sort(key=lambda x: x['qty'], reverse=True)

    return JsonResponse({
        'success': True,
        'total_sales': float(total_sales),
        'total_transactions': total_trans,
        'avg_sale': avg_sale,
        'products': data[:5],
    })


def api_reports_inventory(request):
    products = Product.objects.all()
    total_products = products.count()
    total_value = sum(float(p.price) * p.stock for p in products)
    low_stock = products.filter(stock__lte=5).count()

    product_list = [{
        'name': p.name,
        'category': p.category,
        'price': float(p.price),
        'stock': p.stock,
        'total': float(p.price) * p.stock,
    } for p in products]

    return JsonResponse({
        'success': True,
        'total_products': total_products,
        'total_stock_value': total_value,
        'low_stock': low_stock,
        'products': product_list,
    })



# ── MOBILE API LOGIN ──
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

@csrf_exempt
def api_login(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        username = data.get('username', '').strip()
        password = data.get('password', '')
        try:
            user = User.objects.get(username=username)
            if user.password == hash_password(password):
                return JsonResponse({
                    'success': True,
                    'user_id': str(user.user_id),
                    'username': user.username,
                    'role': user.role,
                })
            return JsonResponse({'success': False, 'message': 'Invalid password.'}, status=401)
        except User.DoesNotExist:
            return JsonResponse({'success': False, 'message': 'User not found.'}, status=404)

@csrf_exempt
def api_mobile_products(request):
    products = Product.objects.filter(stock__gt=0).values(
        'product_id', 'name', 'category', 'price', 'stock'
    )
    return JsonResponse({'success': True, 'products': list(products)})

@csrf_exempt
def api_mobile_checkout(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        items = data.get('items', [])
        total = data.get('total', 0)
        user_id = data.get('user_id')

        try:
            user = User.objects.get(user_id=user_id)
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