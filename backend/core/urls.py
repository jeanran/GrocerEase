from django.urls import path
from . import views

urlpatterns = [

    # ========================
    # AUTHENTICATION
    # ========================
    path('',        views.login_view,  name='login'),
    path('login/',  views.login_view,  name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('verify/<str:token>/', views.verify_email, name='verify_email'),

    # ========================
    # PAGE ROUTES
    # ========================
    path('dashboard/',  views.dashboard,    name='dashboard'),
    path('products/',   views.products,     name='products'),
    path('stock-in/',   views.stock_in,     name='stock_in'),
    path('stock-in-history/', views.stock_in_history, name='stock_in_history'),
    path('stock-out/',  views.stock_out,    name='stock_out'),
    path('pos/',        views.pos,          name='pos'),
    path('orders/',     views.orders,       name='orders'),
    path('reports/',    views.reports,      name='reports'),
    path('users/',      views.manage_users, name='users'),

    # ========================
    # DASHBOARD APIs
    # ========================
    path('api/dashboard/stats/',  views.api_dashboard_stats,  name='api_dashboard_stats'),
    path('api/dashboard/charts/', views.api_dashboard_charts, name='api_dashboard_charts'),

    # ========================
    # USER APIs
    # ========================
    path('api/users/',                      views.api_users_list,   name='api_users_list'),
    path('api/users/add/',                  views.api_users_add,    name='api_users_add'),
    path('api/users/<str:user_id>/edit/',   views.api_users_edit,   name='api_users_edit'),
    path('api/users/<str:user_id>/delete/', views.api_users_delete, name='api_users_delete'),

    # ========================
    # PRODUCT APIs
    # ========================
    path('api/products/',                         views.api_products_list,   name='api_products_list'),
    path('api/products/add/',                     views.api_products_add,    name='api_products_add'),
    path('api/products/<str:product_id>/edit/',   views.api_products_edit,   name='api_products_edit'),
    path('api/products/<str:product_id>/delete/', views.api_products_delete, name='api_products_delete'),

    # ========================
    # STOCK IN APIs
    # ========================
    path('api/stock-in/',     views.api_stock_in_list, name='api_stock_in_list'),
    path('api/stock-in/add/', views.api_stock_in_add,  name='api_stock_in_add'),
    path('api/stock-in-history/', views.stock_in_history, name='api_stock_in_history'),

    # ========================
    # STOCK OUT APIs
    # ========================
    path('api/stock-out/',     views.api_stock_out_list, name='api_stock_out_list'),
    path('api/stock-out/add/', views.api_stock_out_add,  name='api_stock_out_add'),

    # ========================
    # TRANSACTION APIs
    # ========================
    path('api/checkout/',     views.api_checkout,          name='api_checkout'),
    path('api/transactions/', views.api_transactions_list, name='api_transactions_list'),

    # ========================
    # REPORTS APIs
    # ========================
    path('api/reports/sales/',     views.api_reports_sales,     name='api_reports_sales'),
    path('api/reports/inventory/', views.api_reports_inventory, name='api_reports_inventory'),

    # ========================
    # MOBILE APIs
    # ========================
    path('api/login/',                views.api_login,               name='api_login'),
    path('api/mobile/products/',      views.api_mobile_products,     name='api_mobile_products'),
    path('api/mobile/low-stock/',     views.api_mobile_low_stock,    name='api_mobile_low_stock'),
    path('api/mobile/daily-summary/', views.api_mobile_daily_summary,name='api_mobile_daily_summary'),
    path('api/mobile/stock-in/',      views.api_mobile_stock_in_list, name='api_mobile_stock_in_list'),
    path('api/mobile/stock-in/history/', views.api_mobile_stock_in_history, name='api_mobile_stock_in_history'),
    path('api/mobile/stock-in/add/',  views.api_mobile_stock_in,      name='api_mobile_stock_in'),
    path('api/mobile/stock-out/',     views.api_mobile_stock_out_list, name='api_mobile_stock_out_list'),
    path('api/mobile/stock-out/add/', views.api_mobile_stock_out,      name='api_mobile_stock_out'),
    path('api/mobile/checkout/',      views.api_mobile_checkout,      name='api_mobile_checkout'),
    path('api/mobile/transactions/',  views.api_mobile_transactions,  name='api_mobile_transactions'),
    path('api/mobile/users/',         views.api_mobile_users_list,   name='api_mobile_users_list'),
    path('api/mobile/users/add/',     views.api_mobile_users_add,    name='api_mobile_users_add'),
    path('api/mobile/users/<str:user_id>/edit/',   views.api_mobile_users_edit,   name='api_mobile_users_edit'),
    path('api/mobile/users/<str:user_id>/delete/', views.api_mobile_users_delete, name='api_mobile_users_delete'),
]
]
