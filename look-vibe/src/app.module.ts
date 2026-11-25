import { Module } from '@nestjs/common';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { GraphQLModule } from '@nestjs/graphql';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createObserveModule } from '@nestjs/observe';
import { join } from 'node:path';
import type { Request, Response } from 'express';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { BusinessesModule } from './businesses/businesses.module.js';
import { StylistsModule } from './stylists/stylists.module.js';
import { ServicesModule } from './services/services.module.js';
import { AppointmentsModule } from './appointments/appointments.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';
import { FavoritesModule } from './favorites/favorites.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { PortfolioModule } from './portfolio/portfolio.module.js';
import { ReportsModule } from './reports/reports.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    // 1. Carga global del archivo .env como en la base local de la clase
    ConfigModule.forRoot({ isGlobal: true }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      graphiql: false,
      plugins: [ApolloServerPluginLandingPageLocalDefault()],
      context: ({ req, res }: { req: Request; res: Response }) => ({ req, res }),
    }),
    // 2. Conexión a Supabase con SSL habilitado y puerto parseado a número
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: parseInt(configService.get<string>('DB_PORT') || '5432', 10), //esto lo podria quitar porque esta quemado pero es como lo que hacia el profe de manejar el puerto en local
        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        autoLoadEntities: true,
        synchronize: true, // OJO: ponerlo en false en producción
        ssl:
          configService.get<string>('DB_SSL') === 'false'
            ? false
            : { rejectUnauthorized: false },
      }),
    }),


    // módulos de negocio
    AuthModule,
    UsersModule,
    BusinessesModule,
    StylistsModule,
    ServicesModule,
    AppointmentsModule,
    ReviewsModule,
    FavoritesModule,
    NotificationsModule,
    PortfolioModule,
    ReportsModule,
    StylistsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
