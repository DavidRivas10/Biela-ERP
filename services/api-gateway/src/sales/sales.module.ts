import { Module } from "@nestjs/common";
import { CustomersController } from "./customers.controller";
import { SalesController } from "./sales.controller";

@Module({ controllers: [CustomersController, SalesController] })
export class SalesModule {}
