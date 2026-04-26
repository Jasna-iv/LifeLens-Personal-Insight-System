import { DashboardComponent } from './dashboard/dashboard';
import { TasksComponent } from './tasks/tasks';
import { LoginComponent } from './login/login';
import { authGuard } from './auth-guard';
import{ExpenseComponent} from './expenses/expenses'
import { ProfileComponent } from './profile/profile';
import { SignupComponent } from './signup/signup';
import { ForgotPasswordComponent } from './forgot-password/forgot-password';
import { DocumentsComponent } from './documents/documents';
import { InsightsComponent } from './insights/insights';




export const routes = [
  { path: '', component: LoginComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'signup', component: SignupComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'tasks', component: TasksComponent, canActivate: [authGuard] },
  { path: 'expenses', component: ExpenseComponent, canActivate: [authGuard] }, 
  { path: 'profile', component: ProfileComponent, canActivate: [authGuard] },
   { path: 'documents', component: DocumentsComponent,canActivate: [authGuard]  },
  { path: 'insights', component: InsightsComponent,canActivate: [authGuard]  }
];