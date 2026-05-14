from django.db import models
from django.utils import timezone
import uuid

class User(models.Model):
    user_id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username           = models.CharField(max_length=50, unique=True)
    password           = models.CharField(max_length=255)
    email              = models.EmailField(unique=True, null=True, blank=True)
    role               = models.CharField(max_length=10, default='staff')
    is_verified        = models.BooleanField(default=False)
    verification_token = models.CharField(max_length=200, null=True, blank=True)
    created_at         = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'tbl_users'
        managed  = False

    def __str__(self):
        return self.username



class Product(models.Model):
    product_id    = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name          = models.CharField(max_length=100)
    category      = models.CharField(max_length=50)
    unit          = models.CharField(max_length=50, blank=True, null=True)
    price         = models.DecimalField(max_digits=10, decimal_places=2)
    stock         = models.IntegerField(default=0)
    reorder_level = models.IntegerField(default=10)

    class Meta:
        db_table = 'tbl_products'
        managed  = False

    def __str__(self):
        return self.name


class Transaction(models.Model):
    transaction_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    date           = models.DateTimeField(auto_now_add=True)
    total          = models.DecimalField(max_digits=10, decimal_places=2)
    user_id        = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, db_column='user_id')

    class Meta:
        db_table = 'tbl_transactions'
        managed  = False


class TransactionItem(models.Model):
    item_id        = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    transaction_id = models.ForeignKey(Transaction, on_delete=models.CASCADE, db_column='transaction_id')
    product_id     = models.ForeignKey(Product, on_delete=models.CASCADE, db_column='product_id')
    quantity       = models.IntegerField()
    price          = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = 'tbl_transaction_items'
        managed  = False


class StockIn(models.Model):
    stock_in_id   = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product_id    = models.ForeignKey(Product, on_delete=models.CASCADE, db_column='product_id')
    quantity      = models.IntegerField()
    unit          = models.CharField(max_length=50, blank=True, null=True)
    supplier      = models.CharField(max_length=100, blank=True, null=True)
    date_received = models.DateTimeField(default=timezone.now)
    received_by   = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, db_column='received_by')
    notes         = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'tbl_stock_in'
        managed  = False

    def __str__(self):
        return f"Stock In - {self.product_id.name} x{self.quantity}"


class StockOut(models.Model):
    stock_out_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product_id   = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='stockout', db_column='product_id')
    quantity     = models.IntegerField()
    reason       = models.CharField(max_length=50, choices=[
                       ('sold',     'Sold'),
                       ('damaged',  'Damaged'),
                       ('expired',  'Expired'),
                       ('returned', 'Returned to Supplier'),
                   ])
    date        = models.DateTimeField(default=timezone.now)
    recorded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, db_column='recorded_by')
    notes       = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'tbl_stock_out'
        managed  = False

    def __str__(self):
        return f"{self.product_id.name} - {self.reason} ({self.quantity})"

