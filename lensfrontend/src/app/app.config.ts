import { provideHttpClient } from '@angular/common/http';


export const appConfig = {
  providers: [
    provideHttpClient()   // provides HttpClient globally
  ]
};