# check_settings.py
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'grocerease.settings')
import django
django.setup()
from django.conf import settings

print("ALLOWED_HOSTS:", settings.ALLOWED_HOSTS)
print("DEBUG:", settings.DEBUG)