from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import Task, Expense
import json
from django.contrib.auth import authenticate, login
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .serializers import ExpenseSerializer
from django.contrib.auth.models import User
from datetime import datetime

# ---------------- DASHBOARD ----------------
def dashboard(request):
    return render(request, 'dashboard.html')

# ---------------- TASKS ----------------
def get_tasks(request):
    tasks = list(Task.objects.all().values('id', 'title', 'completed', 'deleted', 'date', 'created_at'))
    for t in tasks:
        if not t['date']:
            t['date'] = t['created_at'].date().isoformat()  # send as string
    return JsonResponse(tasks, safe=False)

@csrf_exempt
def add_task(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        user = User.objects.first()
        task_date = data.get('date')
        if task_date:
            task_date = datetime.strptime(task_date, "%Y-%m-%d").date()
        task = Task.objects.create(user=user, title=data['title'], date=task_date)
        return JsonResponse({
            'id': task.id,
            'title': task.title,
            'completed': task.completed,
            'date': task.date.isoformat() if task.date else None
        })

@csrf_exempt
def update_task(request, pk):
    if request.method == 'PATCH':
        task = Task.objects.get(pk=pk)
        data = json.loads(request.body)
        task.completed = data.get('completed', task.completed)
        task.deleted = data.get('deleted', task.deleted)
        task.save()
        return JsonResponse({'id': task.id, 'completed': task.completed, 'deleted': task.deleted})
    return JsonResponse({'error': 'Invalid method'}, status=400)

@csrf_exempt
def delete_task(request, pk):
    if request.method == 'DELETE':
        task = Task.objects.get(pk=pk)
        if task.deleted:
            task.delete()
            return JsonResponse({'message': 'Task permanently deleted'})
        else:
            task.deleted = True
            task.save()
            return JsonResponse({'message': 'Task moved to recycle bin'})
    return JsonResponse({'error': 'Invalid method'}, status=400)

@csrf_exempt
def login_view(request):
    if request.method == "POST":
        data = json.loads(request.body)
        username = data.get("username")
        password = data.get("password")
        user = authenticate(request, username=username, password=password)
        if user:
            login(request, user)
            return JsonResponse({"message": "Login successful"})
        return JsonResponse({"error": "Invalid credentials"}, status=400)

# ---------------- EXPENSES ----------------
@csrf_exempt
def get_expenses(request):
    try:
        user = User.objects.first()
        expenses = Expense.objects.filter(user=user, deleted=False)
        data = {
            'expenses': [
                {'id': e.id, 'amount': e.amount, 'category': e.category, 'date': e.date.isoformat()}
                for e in expenses
            ]
        }
        return JsonResponse(data)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def add_expense(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        user = request.user if request.user.is_authenticated else User.objects.first()
        date = datetime.strptime(data.get('date'), "%Y-%m-%d").date() if data.get('date') else datetime.now().date()
        expense = Expense.objects.create(
            user=user,
            category=data.get('category'),
            amount=float(data.get('amount')),
            date=date
        )
        return JsonResponse({'id': expense.id, 'amount': expense.amount, 'category': expense.category, 'date': expense.date})

@csrf_exempt
def update_expense(request, id):
    if request.method in ['PUT', 'PATCH']:
        try:
            expense = Expense.objects.get(id=id)
        except Expense.DoesNotExist:
            return JsonResponse({'error': 'Not found'}, status=404)
        data = json.loads(request.body)
        expense.amount = float(data.get('amount', expense.amount))
        expense.category = data.get('category', expense.category)
        if data.get('date'):
            expense.date = datetime.strptime(data.get('date'), "%Y-%m-%d").date()
        expense.save()
        return JsonResponse({'id': expense.id, 'amount': expense.amount, 'category': expense.category, 'date': expense.date})
    return JsonResponse({'error': 'Method not allowed'}, status=405)

@csrf_exempt
def expense_delete(request, id):
    if request.method == 'DELETE':
        try:
            expense = Expense.objects.get(id=id)
            expense.delete()
            return JsonResponse({'message': 'Deleted'}, status=204)
        except Expense.DoesNotExist:
            return JsonResponse({'error': 'Not found'}, status=404)
    return JsonResponse({'error': 'Method not allowed'}, status=405)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def expense_list(request):
    user = request.user
    expenses = Expense.objects.filter(user=user, deleted=False)

    # Filter by month
    month = request.GET.get('month')
    if month:
        year, mon = map(int, month.split('-'))
        expenses = expenses.filter(date__year=year, date__month=mon)

    # Filter by type
    type_filter = request.GET.get('type')  # 'Income' or 'Expense'
    if type_filter == 'Income':
        expenses = expenses.filter(amount__gte=0)
    elif type_filter == 'Expense':
        expenses = expenses.filter(amount__lt=0)

    serializer = ExpenseSerializer(expenses, many=True)
    return Response(serializer.data)