import { BrowserModule } from '@angular/platform-browser';
import { ReactiveFormsModule } from '@angular/forms';
import { NgModule, inject, provideAppInitializer } from '@angular/core';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { GraphComponent } from './graph/graph.component'
import { SubgraphComponent } from './graph/subgraph/subgraph.component'
import { GraphFormService } from './_services/_graph/graph-form.service'

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { GraphMathService } from './_services/_graph/graph-math.service';
import { AppRoutingModule } from './app-routing.module';
import { JsonFileService } from './_services/_file/json-file.service';
import { HttpService } from './_services/_http/http.service';
import { XAxisPointComponent } from './graph/x-axis-point/x-axis-point.component';
import { YAxisPointComponent } from './graph/y-axis-point/y-axis-point.component';
import { ConfigurationService } from './_services/_config/configuration.service';

@NgModule({
    declarations: [
        AppComponent,
        SubgraphComponent,
        XAxisPointComponent,
        YAxisPointComponent,
        GraphComponent
    ],
    bootstrap: [AppComponent],
    imports: [
        AppRoutingModule,
        BrowserModule,
        FormsModule,
        ReactiveFormsModule,
        NgbModule,
        BrowserAnimationsModule
    ],
    providers: [
        provideAppInitializer(() => {
        const initializerFn = ((config: ConfigurationService) => () => config.loadAppConfig())(inject(ConfigurationService));
        return initializerFn();
      }),
        GraphFormService,
        GraphMathService,
        JsonFileService,
        HttpService,
        provideHttpClient(withInterceptorsFromDi())
    ]
})
export class AppModule { }
