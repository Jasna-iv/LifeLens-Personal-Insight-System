import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { Chart } from 'chart.js/auto';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, DatePipe],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent implements OnInit {

  // ---------------- DATA ----------------
  tasks: any[] = [];
  expenses: any[] = [];

  filteredTasks: any[] = [];
  filteredExpenses: any[] = [];

  // ---------------- STATS ----------------
  totalTasks = 0;
  completedTasks = 0;
  pendingTasks = 0;

  totalExpense = 0;
  totalIncome = 0;
  totalBalance = 0;

  today = new Date();

  // ---------------- CALENDAR ----------------
  currentDate = new Date();
  selectedDate: Date | null = null;

  weekDays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  calendarDays: (Date | null)[] = [];

  // ---------------- CHARTS ----------------
  taskChart: any;
  expenseChart: any;
  barChart: any;

  API = 'http://127.0.0.1:8000';

  // ✅ prevent double filtering
  dataLoaded = {
    tasks: false,
    expenses: false
  };

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private zone: NgZone
  ) {}

  // ---------------- INIT ----------------
  ngOnInit() {
    this.generateCalendar();
    this.loadTasks();
    this.loadExpenses();

    setInterval(() => {
      this.zone.run(() => {
        this.loadTasks();
        this.loadExpenses();
      });
    }, 25000);
  }

  // ---------------- CALENDAR ----------------
  generateCalendar() {
    this.calendarDays = [];

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
      this.calendarDays.push(null);
    }

    for (let i = 1; i <= totalDays; i++) {
      this.calendarDays.push(new Date(year, month, i));
    }
  }

  nextMonth() {
    this.currentDate = new Date(
      this.currentDate.getFullYear(),
      this.currentDate.getMonth() + 1,
      1
    );

    this.selectedDate = null;
    this.generateCalendar();
    this.filterByMonth();
  }

  prevMonth() {
    this.currentDate = new Date(
      this.currentDate.getFullYear(),
      this.currentDate.getMonth() - 1,
      1
    );

    this.selectedDate = null;
    this.generateCalendar();
    this.filterByMonth();
  }

  selectDate(day: Date | null) {
    if (!day) return;

    this.selectedDate = day;
    this.filterByDate(day);
  }

  isSelected(day: Date | null): boolean {
    if (!day || !this.selectedDate) return false;
    return day.toDateString() === this.selectedDate.toDateString();
  }

  // ---------------- FILTER BY MONTH ----------------
  filterByMonth() {
    const month = this.currentDate.getMonth();
    const year = this.currentDate.getFullYear();

    const mTasks = this.tasks.filter(t => {
      if (!t.date) return false;
      const d = new Date(t.date);
      return d.getMonth() === month && d.getFullYear() === year;
    });

    const mExpenses = this.expenses.filter(e => {
      if (!e.date) return false;
      const d = new Date(e.date);
      return d.getMonth() === month && d.getFullYear() === year;
    });

    this.applyFilteredData(mTasks, mExpenses);
  }

  // ---------------- FILTER BY DATE ----------------
  filterByDate(date: Date) {
    const selected = date.toDateString();

    const dTasks = this.tasks.filter(t =>
      t.date && new Date(t.date).toDateString() === selected
    );

    const dExpenses = this.expenses.filter(e =>
      e.date && new Date(e.date).toDateString() === selected
    );

    this.applyFilteredData(dTasks, dExpenses);
  }

  // ---------------- APPLY FILTERED DATA ----------------
  applyFilteredData(tasks: any[], expenses: any[]) {
    this.filteredTasks = tasks;
    this.filteredExpenses = expenses;

    this.totalTasks = tasks.length;
    this.completedTasks = tasks.filter(t => t.completed).length;
    this.pendingTasks = tasks.filter(t => !t.completed).length;

    this.totalIncome = expenses
      .filter(e => Number(e.amount) > 0)
      .reduce((s, e) => s + Number(e.amount), 0);

    this.totalExpense = expenses
      .filter(e => Number(e.amount) < 0)
      .reduce((s, e) => s + Math.abs(Number(e.amount)), 0);

    this.totalBalance = this.totalIncome - this.totalExpense;

    setTimeout(() => {
      this.renderTaskChart();
      this.renderExpenseChart(expenses);
      this.renderBarChart(expenses);
    }, 100);
  }

  // ---------------- LOAD TASKS ----------------
  loadTasks() {
    this.http.get<any>(`${this.API}/tasks/`)
      .subscribe(res => {

        let tasks = [];

        if (Array.isArray(res)) tasks = res;
        else if (res.results) tasks = res.results;
        else if (res.tasks) tasks = res.tasks;

        this.tasks = tasks.filter((t: any) => !t.deleted);

        this.dataLoaded.tasks = true;
        this.runInitialFilter();

        this.cdr.detectChanges();
      });
  }

  // ---------------- LOAD EXPENSES ----------------
  loadExpenses() {
    this.http.get<any>(`${this.API}/expenses/`)
      .subscribe(res => {

        let exp = [];

        if (Array.isArray(res)) exp = res;
        else if (res.results) exp = res.results;
        else if (res.expenses) exp = res.expenses;

        this.expenses = exp;

        this.dataLoaded.expenses = true;
        this.runInitialFilter();

        this.cdr.detectChanges();
      });
  }

  // ✅ RUN FILTER ONLY AFTER BOTH LOADED
  runInitialFilter() {
    if (this.dataLoaded.tasks && this.dataLoaded.expenses) {
      this.filterByMonth();
    }
  }

  // ---------------- CHARTS ----------------
  renderTaskChart() {
    if (this.taskChart) this.taskChart.destroy();

    this.taskChart = new Chart('taskChart', {
      type: 'doughnut',
      data: {
        labels: ['Completed', 'Pending'],
        datasets: [{
          data: [this.completedTasks, this.pendingTasks],
          backgroundColor: ['#22c55e', '#f59e0b']
        }]
      }
    });
  }

  renderExpenseChart(exp: any[]) {
    if (this.expenseChart) this.expenseChart.destroy();

    const map: any = {};

    exp.forEach(e => {
      const key = e.category || 'Other';
      if (!map[key]) map[key] = 0;
      map[key] += Number(e.amount);
    });

    this.expenseChart = new Chart('expenseChart', {
      type: 'pie',
      data: {
        labels: Object.keys(map),
        datasets: [{
          data: Object.values(map),
          backgroundColor: ['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6']
        }]
      }
    });
  }

  renderBarChart(exp: any[]) {
    if (this.barChart) this.barChart.destroy();

    const monthly = new Array(12).fill(0);

    exp.forEach(e => {
      const date = new Date(e.date);
      if (!isNaN(date.getTime())) {
        monthly[date.getMonth()] += Number(e.amount);
      }
    });

    this.barChart = new Chart('barChart', {
      type: 'bar',
      data: {
        labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
        datasets: [{
          data: monthly,
          backgroundColor: '#3b82f6'
        }]
      }
    });
  }

  // ---------------- UTIL ----------------
  getSavingsRate() {
    if (this.totalIncome === 0) return 0;
    return ((this.totalBalance / this.totalIncome) * 100).toFixed(1);
  }

  logout() {
    localStorage.removeItem('isLoggedIn');
    this.router.navigate(['']);
  }
}