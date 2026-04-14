import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { Chart } from 'chart.js/auto';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { ViewChild, ElementRef, AfterViewInit } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, DatePipe],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent implements OnInit, AfterViewInit {

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

  API_URL = 'http://localhost:8000';

  dataLoaded = {
    tasks: false,
    expenses: false
  };

  @ViewChild('taskChart') taskChartRef!: ElementRef;
  @ViewChild('expenseChart') expenseChartRef!: ElementRef;
  @ViewChild('barChart') barChartRef!: ElementRef;

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

  ngAfterViewInit() {}

  // ---------------- SAFE API PARSER ----------------
  private extractList(res: any, key: string): any[] {
    if (Array.isArray(res)) return res;
    if (res?.results) return res.results;
    if (res?.[key]) return res[key];
    return [];
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
    this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 1);
    this.selectedDate = null;
    this.generateCalendar();
    this.filterByMonth();
  }

  prevMonth() {
    this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 1);
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

  // ---------------- LOAD TASKS ----------------
  loadTasks() {
    this.http.get(`${this.API_URL}/tasks/`, { withCredentials: true }).subscribe(res => {

      const tasks = this.extractList(res, 'tasks')
        .filter((t: any) => !t.deleted)
        .map((t: any) => ({
          id: t.id,
          title: t.title,
          completed: t.completed,
          deleted: t.deleted,
          date: t.date ? new Date(t.date) : null
        }));

      this.tasks = tasks;

      this.dataLoaded.tasks = true;
      this.runInitialFilter();
    });
  }

  // ---------------- LOAD EXPENSES ----------------
  loadExpenses() {
    this.http.get(`${this.API_URL}/expenses/`, { withCredentials: true }).subscribe(res => {

      const exp = this.extractList(res, 'expenses')
        .map((e: any) => ({
          id: e.id,
          amount: Number(e.amount),
          category: e.category,
          date: e.date ? new Date(e.date) : null
        }));

      this.expenses = exp;

      this.dataLoaded.expenses = true;
      this.runInitialFilter();
    });
  }

  // ---------------- INITIAL FILTER ----------------
  runInitialFilter() {
    if (this.dataLoaded.tasks && this.dataLoaded.expenses) {
      this.filterByMonth();
    }
  }

  // ---------------- FILTER MONTH ----------------
  filterByMonth() {
    const m = this.currentDate.getMonth();
    const y = this.currentDate.getFullYear();

    const mTasks = this.tasks.filter(t =>
      t.date && t.date.getMonth() === m && t.date.getFullYear() === y
    );

    const mExpenses = this.expenses.filter(e =>
      e.date && e.date.getMonth() === m && e.date.getFullYear() === y
    );

    this.applyFilteredData(mTasks, mExpenses);
  }

  // ---------------- FILTER DATE ----------------
  filterByDate(date: Date) {
    const dTasks = this.tasks.filter(t =>
      t.date && t.date.toDateString() === date.toDateString()
    );

    const dExpenses = this.expenses.filter(e =>
      e.date && e.date.toDateString() === date.toDateString()
    );

    this.applyFilteredData(dTasks, dExpenses);
  }

  // ---------------- APPLY DATA ----------------
  applyFilteredData(tasks: any[], expenses: any[]) {

    this.filteredTasks = tasks;
    this.filteredExpenses = expenses;

    this.totalTasks = tasks.length;
    this.completedTasks = tasks.filter(t => t.completed).length;
    this.pendingTasks = tasks.filter(t => !t.completed).length;

    this.totalIncome = expenses
      .filter(e => e.amount > 0)
      .reduce((s, e) => s + e.amount, 0);

    this.totalExpense = expenses
      .filter(e => e.amount < 0)
      .reduce((s, e) => s + Math.abs(e.amount), 0);

    this.totalBalance = this.totalIncome - this.totalExpense;

    this.cdr.detectChanges();

    this.renderTaskChart();
    this.renderExpenseChart(expenses);
    this.renderBarChart(expenses);
  }

  // ---------------- CHARTS ----------------
  renderTaskChart() {
    if (!this.taskChartRef) return;

    if (this.taskChart) this.taskChart.destroy();

    this.taskChart = new Chart(this.taskChartRef.nativeElement, {
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
    if (!this.expenseChartRef) return;

    if (this.expenseChart) this.expenseChart.destroy();

    const map: any = {};
    exp.forEach(e => {
      const key = e.category || 'Other';
      map[key] = (map[key] || 0) + e.amount;
    });

    this.expenseChart = new Chart(this.expenseChartRef.nativeElement, {
      type: 'pie',
      data: {
        labels: Object.keys(map),
        datasets: [{
          data: Object.values(map)
        }]
      }
    });
  }

  renderBarChart(exp: any[]) {
    if (!this.barChartRef) return;

    if (this.barChart) this.barChart.destroy();

    const monthly = new Array(12).fill(0);

    exp.forEach(e => {
      if (e.date) {
        monthly[e.date.getMonth()] += e.amount;
      }
    });

    this.barChart = new Chart(this.barChartRef.nativeElement, {
      type: 'bar',
      data: {
        labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
        datasets: [{ data: monthly }]
      }
    });
  }

  // ---------------- UTIL ----------------
  getSavingsRate() {
    if (this.totalIncome === 0) return 0;
    return ((this.totalBalance / this.totalIncome) * 100).toFixed(1);
  }

  // ---------------- NAV ----------------
  logout() {
    localStorage.removeItem('isLoggedIn');
    this.router.navigate(['']);
  }

  goToProfile() {
    this.router.navigate(['/profile']);
  }
}