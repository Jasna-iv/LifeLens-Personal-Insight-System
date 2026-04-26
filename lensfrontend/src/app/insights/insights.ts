import {
  Component,
  OnInit,
  AfterViewInit,
  ViewChild,
  ElementRef,
  ChangeDetectorRef
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

import { Chart } from 'chart.js/auto';
const centerTextPlugin = {
  id: 'centerText',
  beforeDraw(chart: any) {
    const { width, height, ctx } = chart;

    ctx.save();

    const data = chart.data.datasets[0].data;
    const expense = data[0] || 0;

    // MAIN VALUE
    ctx.font = 'bold 16px Inter';
    ctx.fillStyle = '#e5e7eb';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`₹${expense}`, width / 2, height / 1.7);

    // SUB TEXT
    ctx.font = '11px Inter';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Expense', width / 2, height / 1.45);

    ctx.restore();
  }
};
@Component({
  selector: 'app-insights',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule, RouterModule],
  templateUrl: './insights.html',
  styleUrls: ['./insights.css']
})
export class InsightsComponent implements OnInit, AfterViewInit {

  // ================= DATA =================
  insights: any;
  expenses: any[] = [];

  completedTasks: number = 0;
  pendingTasks: number = 0;

  messages: any[] = [
    { type: 'bot', text: '👋 Ask me anything about your data' }
  ];

  chats: any[] = [];
  searchText = '';
  userInput = '';
  
  aiText = '';

  expensePercent: number = 0;

  private loading = false;
  private httpOptions = {
  withCredentials: true
};
  // ================= CHART REFS =================
  @ViewChild('chatBox') chatBox!: ElementRef;
  @ViewChild('taskChart') taskChartRef!: ElementRef;
  @ViewChild('expenseChart') expenseChartRef!: ElementRef;
  @ViewChild('barChart', { static: false }) barChartRef!: ElementRef;
  @ViewChild('inputBox') inputBox!: ElementRef;

  taskChart: any;
  expenseChart: any;
  barChart: any;

  // ================= API =================
  API_CHAT = 'http://localhost.:8000/chat/';
  API_INSIGHTS = 'http://localhost:8000/insights/';
  API_EXPENSES = 'http://localhost:8000/expenses/';

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}
  
  // ================= INIT =================
  ngOnInit() {
    this.loadSavedChats();
    this.refreshData();
  }

  ngAfterViewInit() {
}


  
  // ================= REFRESH =================
  refreshData() {
    if (this.loading) return;

    this.loading = true;

    this.loadInsights();
    this.loadExpenses();

    setTimeout(() => (this.loading = false), 500);
  }

  // ================= INSIGHTS =================
  loadInsights() {

    this.http.get(this.API_INSIGHTS, {
  withCredentials: true
}).subscribe({
next: (res: any) => {

  this.insights = res;

  const income = Number(res?.total_income || 0);
  const expense = Number(res?.total_expense || 0);

  this.expensePercent =
    income > 0 ? Math.round((expense / income) * 100) : 0;

  this.completedTasks = res?.completed_tasks || 0;
  this.pendingTasks = (res?.total_tasks || 0) - this.completedTasks;

  if (this.pendingTasks < 0) this.pendingTasks = 0;

  this.updateAI();

  setTimeout(() => {
    this.renderTaskChart();
    this.renderIncomeExpenseChart(); // ✅ HERE
  }, 200);

  this.cdr.detectChanges();
},
      error: () => {
        this.insights = null;
        this.completedTasks = 0;
        this.pendingTasks = 0;
        this.aiText = '⚠️ Failed to load insights';
      }
    });
  }

  // ================= EXPENSES =================
loadExpenses() {
  console.log("CALLING EXPENSES API...");
  this.http.get(this.API_EXPENSES, {
  withCredentials: true
}).subscribe({
  next: (res: any) => {

    const list =
      Array.isArray(res) ? res :
      res?.expenses ? res.expenses :
      res?.results ? res.results :
      [];

    this.expenses = list.map((e: any) => ({
      amount: Number(e.amount || 0),
      date: e.date ? new Date(e.date) : null,
      type: e.amount > 0 ? 'income' : 'expense'
    }));

    this.cdr.detectChanges();

    setTimeout(() => {
  if (this.barChartRef?.nativeElement) {
    this.renderBarChart(this.expenses);
  }
}, 200);
  },


    error: (err) => {
  console.error('Expenses API failed:', err);

  this.expenses = [];

  // DO NOT render empty chart
  this.barChart?.destroy();
}
  });
}

  // ================= CHART 1: TASK =================
 renderTaskChart() {

  if (!this.taskChartRef?.nativeElement) return;

  this.taskChart?.destroy();

  this.taskChart = new Chart(this.taskChartRef.nativeElement, {
    type: 'pie',
    data: {
      datasets: [{
        data: [this.completedTasks, this.pendingTasks],
        backgroundColor: ['#3b82f6', '#364762'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: 0
      },
      plugins: {
  legend: { display: false },
  tooltip: {
    bodyFont: {
      size: 8   // 👈 text size for "Completed / Pending"
    },
    titleFont: {
      size: 16
    },
    callbacks: {
      label: (ctx: any) => {
        const labels = ['Completed', 'Pending'];
        return `${labels[ctx.dataIndex]}: ${ctx.raw}`;
      }
    }
  }
}
    }
  });
}

  // ================= CHART 2: EXPENSE =================
renderIncomeExpenseChart() {

  if (!this.expenseChartRef?.nativeElement) return;
  if (!this.insights) return;

  if (this.expenseChart) this.expenseChart.destroy();

  const income = Number(this.insights?.total_income || 0);
  const expense = Number(this.insights?.total_expense || 0);
  const remaining = income - expense;
this.expenseChart = new Chart(this.expenseChartRef.nativeElement, {
  type: 'pie',   // ✅ same as task chart

  data: {
    labels: ['Expense', 'Remaining'],
    datasets: [{
      data: [expense, remaining],
      backgroundColor: ['#67e8f9', '#364762'],
      borderWidth: 0
    }]
  },

  options: {
    responsive: true,
    maintainAspectRatio: false,

    plugins: {
      legend: { display: false },

      tooltip: {
  enabled: true,
  displayColors: false,

  backgroundColor: '#0f172a',
  titleColor: '#e5e7eb',
  bodyColor: '#e5e7eb',

  borderColor: 'rgba(59,130,246,0.3)',
  borderWidth: 1,

  padding: 6,
  cornerRadius: 6,

  titleFont: {
    size: 0   // ❌ removes title completely
  },

  bodyFont: {
    size: 8,
    family: 'Inter'
  },

  callbacks: {
    title: () => '',   // ❌ no title line at all

    label: (ctx: any) => {
      const labels = ['Expense', 'Remaining'];
      return `${labels[ctx.dataIndex]}: ₹${ctx.raw}`;
    }
  }

      }
    }
  }
});
}
  // ================= CHART 3: MONTHLY =================
renderBarChart(exp: any[]) {
  const canvas = this.barChartRef?.nativeElement;
  if (!canvas) return;

  if (this.barChart) {
    this.barChart.destroy();
    this.barChart = null;
  }

  const monthlyExpense = new Array(12).fill(0);
  const monthlyIncome = new Array(12).fill(0);

  exp?.forEach(e => {
    if (!e?.date) return;

    const d = new Date(e.date);
    if (isNaN(d.getTime())) return;

    const month = d.getMonth();

    if (e.amount < 0) {
      monthlyExpense[month] += Math.abs(e.amount);
    } else {
      monthlyIncome[month] += e.amount;
    }
  });

  this.barChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
      datasets: [
        {
          label: 'Expense',
          data: monthlyExpense,
          backgroundColor: '#ef4444',
          barThickness: 7
        },
        {
          label: 'Income',
          data: monthlyIncome,
          backgroundColor: '#22c55e',
          barThickness: 7
        }
      ]
    },
    options: {
  responsive: true,
  maintainAspectRatio: false,

  plugins: {
    legend: {
      position: 'top',
      labels: {
        color: '#94a3b8',
        font: { size: 8 }
      }
    },

    tooltip: {
      backgroundColor: '#0f172a',
      titleColor: '#e5e7eb',
      bodyColor: '#e5e7eb',
      padding: 10,
      cornerRadius: 8
    }
  },

  scales: {
    x: {
      grid: {
        display: false
      },
      ticks: {
        color: '#94a3b8',
        font: { size: 10 }
      }
    },

    y: {
      grid: {
        color: 'rgba(255,255,255,0.05)'
      },
      ticks: {
        color: '#94a3b8',
        font: { size: 10 },
        callback: (v: any) => `₹${v}`
      }
    }
  }
}
  });
}
 // ================= AI =================
  updateAI() {

    const income = Number(this.insights?.total_income || 0);
    const expense = Number(this.insights?.total_expense || 0);

    const completed = this.completedTasks;
    const pending = this.pendingTasks;

    if (completed === 0 && pending === 0) {
      this.aiText = '⚠️ No tasks yet. Start adding tasks.';
    }
    else if (pending > completed * 2) {
      this.aiText = '🚨 Too many pending tasks.';
    }
    else if (expense > income) {
      this.aiText = '⚠️ You are overspending.';
    }
    else {
      this.aiText = '✅ Everything looks balanced.';
    }
  }

  // ================= CHAT =================
sendMessage() {
  if (!this.userInput.trim()) return;

  const msg = this.userInput;

  this.messages = [
    ...this.messages,
    { type: 'user', text: msg },
    { type: 'bot', text: 'Typing...' }
  ];

  this.userInput = '';
  this.inputBox?.nativeElement.focus();

  this.scroll(); // ✅ ADD THIS (important)

  this.http.post(this.API_CHAT, { message: msg }, this.httpOptions)
    .subscribe({
      next: (res: any) => {

        this.messages[this.messages.length - 1] = {
          type: 'bot',
          text: res.reply
        };
        this.cdr.detectChanges();  
        this.scroll(); // ✅ again after response
      }
    });
}

  scroll() {
    setTimeout(() => {
      if (this.chatBox) {
        this.chatBox.nativeElement.scrollTop =
          this.chatBox.nativeElement.scrollHeight;
      }
    }, 50);
  }

  // ================= NAV =================
  goToDashboard() { this.router.navigate(['/dashboard']); }
  goToTasks() { this.router.navigate(['/tasks']); }
  goToExpenses() { this.router.navigate(['/expenses']); }
  goToDocuments() { this.router.navigate(['/documents']); }
  goToProfile() { this.router.navigate(['/profile']); }

  logout() {
    localStorage.clear();
    this.router.navigate(['']);
  }

  // ================= CHAT HISTORY =================
  saveChat(title: string) {
    const chat = {
      title,
      messages: structuredClone(this.messages)
    };

    this.chats.unshift(chat);
    localStorage.setItem('insights_chats', JSON.stringify(this.chats));
  }

  loadSavedChats() {
    const data = localStorage.getItem('insights_chats');
    if (data) this.chats = JSON.parse(data);
  }

  loadChat(chat: any) {
    this.messages = structuredClone(chat.messages || []);
    this.scroll();
  }

  deleteChat(i: number) {
    this.chats.splice(i, 1);
    localStorage.setItem('insights_chats', JSON.stringify(this.chats));
  }

  filteredChats() {
    return this.chats.filter(c =>
      c.title.toLowerCase().includes(this.searchText.toLowerCase())
    );
  }

  newChat() {
    this.messages = [{ type: 'bot', text: 'New chat started 👋' }];
  }
}