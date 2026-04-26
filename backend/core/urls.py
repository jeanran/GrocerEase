from django.urls import path
from . import views

urlpatterns = [

    # ========================
    # AUTHENTICATION
    # ========================
    path('', views.login_view, name='login'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),

    # ========================
    # PAGE ROUTES
    # ========================
    path('dashboard/', views.dashboard, name='dashboard'),
    path('pos/', views.pos, name='pos'),
    path('products/', views.products, name='products'),
    path('orders/', views.orders, name='orders'),
    path('reports/', views.reports, name='reports'),
    path('users/', views.manage_users, name='users'),

    # ========================
    # USER APIs
    # ========================
    path('api/users/', views.api_users_list, name='api_users_list'),
    path('api/users/add/', views.api_users_add, name='api_users_add'),
    path('api/users/<str:user_id>/edit/', views.api_users_edit, name='api_users_edit'),
    path('api/users/<str:user_id>/delete/', views.api_users_delete, name='api_users_delete'),

    # ========================
    # PRODUCT APIs
    # ========================
    path('api/products/', views.api_products_list, name='api_products_list'),
    path('api/products/add/', views.api_products_add, name='api_products_add'),
    path('api/products/<str:product_id>/edit/', views.api_products_edit, name='api_products_edit'),
    path('api/products/<str:product_id>/delete/', views.api_products_delete, name='api_products_delete'),

    # ========================
    # POS / TRANSACTIONS
    # ========================
    path('api/checkout/', views.api_checkout, name='api_checkout'),

    # ========================
    # DASHBOARD APIs
    # ========================
    path('api/dashboard/stats/', views.api_dashboard_stats, name='api_dashboard_stats'),
    path('api/dashboard/charts/', views.api_dashboard_charts, name='api_dashboard_charts'),

    path('api/transactions/', views.api_transactions_list, name='api_transactions_list'),
    path('api/reports/sales/', views.api_reports_sales, name='api_reports_sales'),
    path('api/reports/inventory/', views.api_reports_inventory, name='api_reports_inventory'),



    path('api/login/', views.api_login, name='api_login'),
    path('api/mobile/products/', views.api_mobile_products, name='api_mobile_products'),
    path('api/mobile/checkout/', views.api_mobile_checkout, name='api_mobile_checkout'),
]