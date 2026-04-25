from django.db import models
import uuid

class User(models.Model):
    user_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = models.CharField(max_length=50, unique=True)
    password = models.CharField(max_length=255)
    role = models.CharField(max_length=10, choices=[('admin','Admin'),('cashier','Cashier')], default='cashier')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'tbl_users'
        managed = False

    def __str__(self):
        return self.username

class Product(models.Model):
    product_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    category = models.CharField(max_length=50)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    stock = models.IntegerField(default=0)

    class Meta:
        db_table = 'tbl_products'
        managed = False

    def __str__(self):
        return self.name
    
class Transaction(models.Model):
    transaction_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    date = models.DateTimeField(auto_now_add=True)
    total = models.DecimalField(max_digits=10, decimal_places=2)
    user_id = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, db_column='user_id')

    class Meta:
        db_table = 'tbl_transactions'
        managed = False

class TransactionItem(models.Model):
    item_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    transaction_id = models.ForeignKey(Transaction, on_delete=models.CASCADE, db_column='transaction_id')
    product_id = models.ForeignKey(Product, on_delete=models.CASCADE, db_column='product_id')
    quantity = models.IntegerField()
    price = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = 'tbl_transaction_items'
        managed = False