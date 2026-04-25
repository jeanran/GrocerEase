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
