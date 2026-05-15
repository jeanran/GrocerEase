from django.contrib import admin
from django.urls import path
from . import views

urlpatterns = [
    path('admin/', admin.site.urls),

    path('', views.home, name='home'),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('pos/', views.pos, name='pos'),
    path('products/', views.products, name='products'),
    path('orders/', views.orders, name='orders'),
    path('reports/', views.reports, name='reports'),
    path('accounts/login/', views.login_view, name='login'),
]


# ========================
# PAGE VIEWS
# ========================



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
