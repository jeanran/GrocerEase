from django.db import migrations
from django.conf import settings
import os
import uuid


def create_local_tables(apps, schema_editor):
    if not getattr(settings, 'USE_LOCAL_SQLITE', False):
        return
    if schema_editor.connection.vendor != 'sqlite':
        return

    statements = [
        """
        CREATE TABLE IF NOT EXISTS tbl_users (
            user_id TEXT PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            email VARCHAR(254) UNIQUE,
            role VARCHAR(10) NOT NULL DEFAULT 'staff',
            is_verified INTEGER NOT NULL DEFAULT 0,
            verification_token VARCHAR(200),
            created_at TEXT NOT NULL
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS tbl_products (
            product_id TEXT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            category VARCHAR(50) NOT NULL,
            unit VARCHAR(50),
            price NUMERIC(10, 2) NOT NULL,
            stock INTEGER NOT NULL DEFAULT 0,
            reorder_level INTEGER NOT NULL DEFAULT 10
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS tbl_transactions (
            transaction_id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            total NUMERIC(10, 2) NOT NULL,
            user_id TEXT,
            FOREIGN KEY(user_id) REFERENCES tbl_users(user_id) ON DELETE SET NULL
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS tbl_transaction_items (
            item_id TEXT PRIMARY KEY,
            transaction_id TEXT NOT NULL,
            product_id TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            price NUMERIC(10, 2) NOT NULL,
            FOREIGN KEY(transaction_id) REFERENCES tbl_transactions(transaction_id) ON DELETE CASCADE,
            FOREIGN KEY(product_id) REFERENCES tbl_products(product_id) ON DELETE CASCADE
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS tbl_stock_in (
            stock_in_id TEXT PRIMARY KEY,
            product_id TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            unit VARCHAR(50),
            supplier VARCHAR(100),
            date_received TEXT NOT NULL,
            received_by TEXT,
            notes TEXT,
            FOREIGN KEY(product_id) REFERENCES tbl_products(product_id) ON DELETE CASCADE,
            FOREIGN KEY(received_by) REFERENCES tbl_users(user_id) ON DELETE SET NULL
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS tbl_stock_out (
            stock_out_id TEXT PRIMARY KEY,
            product_id TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            reason VARCHAR(50) NOT NULL,
            date TEXT NOT NULL,
            recorded_by TEXT,
            notes TEXT,
            FOREIGN KEY(product_id) REFERENCES tbl_products(product_id) ON DELETE CASCADE,
            FOREIGN KEY(recorded_by) REFERENCES tbl_users(user_id) ON DELETE SET NULL
        )
        """,
    ]

    for sql in statements:
        schema_editor.execute(sql)

    # Ensure there is at least one sample product for local development.
    cursor = schema_editor.connection.cursor()
    product_id = str(uuid.uuid4())
    cursor.execute(
        f"INSERT OR IGNORE INTO tbl_products (product_id, name, category, unit, price, stock, reorder_level) VALUES ('{product_id}', 'Sample Product', 'General', 'pcs', 1.00, 0, 10)"
    )
    cursor.close()


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0004_stockin_stockout'),
    ]

    operations = [
        migrations.RunPython(create_local_tables, reverse_code=noop_reverse),
    ]
