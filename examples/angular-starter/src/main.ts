import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { provideAppLingva } from './lingva/providers';

void bootstrapApplication(AppComponent, { providers: [provideAppLingva()] });
