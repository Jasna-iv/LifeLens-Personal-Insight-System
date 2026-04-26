import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Router } from '@angular/router';

interface Expense {
  id: number;
  amount: number;
  category: string;
  date?: string;
  type: 'Income' | 'Expense';
}

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, DatePipe],
  templateUrl: './expenses.html',
  styleUrls: ['./expenses.css']
})
export class ExpenseComponent implements OnInit {

  Math = Math;

  expenses: Expense[] = [];
  filteredExpenses: Expense[] = [];

  selectedMonth: string = '';
  selectedType: 'All' | 'Income' | 'Expense' = 'All';

  newExpense: Omit<Expense, 'id'> = {
    amount: 0,
    category: '',
    date: '',
    type: 'Expense'
  };

  customCategoryInput = '';
  editingExpenseId: number | null = null;
  showCustomCategory = false;

  API_URL = 'http://localhost:8000';

  categories: { [key in 'Income' | 'Expense']: string[] } = {
    Income: ['Salary', 'Freelance', 'Other'],
    Expense: ['Food', 'Travel', 'Shopping', 'Bills', 'Other']
  };

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadExpenses();
  }

  // ---------------- LOAD ----------------
  loadExpenses() {
  this.http.get<any>(`${this.API_URL}/expenses/`, { withCredentials: true })
    .subscribe({
      next: (res) => {
        const data = Array.isArray(res?.expenses) ? res.expenses : [];

        this.expenses = data.map((e: any) => ({
          id: e.id,
          amount: Number(e.amount),
          category: e.category,
          date: e.date,
          type: Number(e.amount) >= 0 ? 'Income' : 'Expense'
        }));

        this.filterByMonthAndType();

        // <-- force Angular to detect changes
        this.cdr.detectChanges();
      },
      error: (err) => console.error('LOAD ERROR:', err)
    });
}
  // ---------------- ADD / UPDATE ----------------
  addExpense() {
    if (!this.newExpense.amount || !this.newExpense.date) return;

    const category =
      this.showCustomCategory
        ? this.customCategoryInput.trim()
        : this.newExpense.category;

    if (!category) return;

    const amount =
      this.newExpense.type === 'Expense'
        ? -Math.abs(this.newExpense.amount)
        : Math.abs(this.newExpense.amount);

    const payload = {
      amount,
      category,
      date: this.newExpense.date
    };

    // ---------------- UPDATE ----------------
    if (this.editingExpenseId !== null) {

      this.http.put(`${this.API_URL}/expenses/${this.editingExpenseId}/update/`, payload, { withCredentials: true }
      ).subscribe({
        next: () => {
          this.loadExpenses();
          this.resetForm();
        },
        error: (err) => console.error('UPDATE ERROR:', err)
      });

    } else {

      // ---------------- CREATE ----------------
      this.http.post(`${this.API_URL}/expenses/add/`, payload,
        { withCredentials: true }
      ).subscribe({
        next: () => {
          this.loadExpenses();
          this.resetForm();
        },
        error: (err) => console.error('ADD ERROR:', err)
      });
    }
  }

  // ---------------- RESET ----------------
  resetForm() {
    this.newExpense = {
      amount: 0,
      category: '',
      date: '',
      type: 'Expense'
    };

    this.customCategoryInput = '';
    this.editingExpenseId = null;
    this.showCustomCategory = false;
  }

  // ---------------- EDIT ----------------
  startEdit(exp: Expense) {
    this.editingExpenseId = exp.id;

    this.newExpense.amount = Math.abs(exp.amount);
    this.newExpense.type = exp.amount >= 0 ? 'Income' : 'Expense';
    this.newExpense.date = exp.date || '';

    if (this.categories[this.newExpense.type].includes(exp.category)) {
      this.newExpense.category = exp.category;
      this.showCustomCategory = false;
    } else {
      this.newExpense.category = 'Other';
      this.showCustomCategory = true;
      this.customCategoryInput = exp.category;
    }
  }

  // ---------------- DELETE ----------------
  deleteExpense(exp: Expense) {
    if (!confirm('Delete this expense?')) return;

    this.http.delete(`${this.API_URL}/expenses/${exp.id}/delete/`, { withCredentials: true }
    ).subscribe({
      next: () => this.loadExpenses(),
      error: (err) => console.error('DELETE ERROR:', err)
    });
  }

  // ---------------- FILTER ----------------
  filterByMonthAndType() {
    this.filteredExpenses = this.expenses.filter(e => {

      const matchType =
        this.selectedType === 'All' || e.type === this.selectedType;

      if (!this.selectedMonth) return matchType;

      if (!e.date) return false;

      const [year, month] = this.selectedMonth.split('-').map(Number);
      const d = new Date(e.date);

      return (
        matchType &&
        d.getFullYear() === year &&
        d.getMonth() + 1 === month
      );
    });

    this.filteredExpenses.sort(
      (a, b) =>
        new Date(b.date || '').getTime() -
        new Date(a.date || '').getTime()
    );
  }

  filterByMonth() {
    this.filterByMonthAndType();
  }

  filterByType(type: 'All' | 'Income' | 'Expense') {
    this.selectedType = type;
    this.filterByMonthAndType();
  }

  // ---------------- TOTALS ----------------
  get totalIncome() {
    return this.filteredExpenses
      .filter(e => e.amount > 0)
      .reduce((s, e) => s + e.amount, 0);
  }

  get totalExpense() {
    return this.filteredExpenses
      .filter(e => e.amount < 0)
      .reduce((s, e) => s + Math.abs(e.amount), 0);
  }

  get balance() {
    return this.totalIncome - this.totalExpense;
  }

  // ---------------- CATEGORY HANDLERS ----------------
  onTypeChange(value: 'Income' | 'Expense') {
    this.newExpense.type = value;
    this.newExpense.category = '';
    this.showCustomCategory = false;
    this.customCategoryInput = '';
  }

  onCategoryChange(value: string) {
    if (value === 'Other') {
      this.showCustomCategory = true;
    } else {
      this.showCustomCategory = false;
      this.newExpense.category = value;
    }
  }

  // ---------------- NAV ----------------
  goToDashboard() {
    this.router.navigate(['/dashboard']);
  }

  goToTasks() {
    this.router.navigate(['/tasks']);
  }
  
  goToDocuments() {
    this.router.navigate(['/documents']);
  }
    goToInsights() {
    this.router.navigate(['/insights']);
  }

  goToProfile() {
    this.router.navigate(['/profile']);
  }
  
  logout() {
    this.router.navigate(['']);
  }
}