import { Module } from "@nestjs/common";
import { CashLedgerService } from "./cash-ledger.service";
import { CashRegistersController } from "./cash-registers.controller";
import { CashRegistersService } from "./cash-registers.service";
import { CashSessionsController } from "./cash-sessions.controller";
import { CashSessionsService } from "./cash-sessions.service";
import { FinancialSummaryService } from "./financial-summary.service";
import { PaymentMethodsController } from "./payment-methods.controller";
import { PaymentMethodsService } from "./payment-methods.service";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

@Module({
  controllers: [
    PaymentMethodsController,
    CashRegistersController,
    CashSessionsController,
    PaymentsController,
  ],
  providers: [
    PaymentMethodsService,
    CashRegistersService,
    CashSessionsService,
    CashLedgerService,
    FinancialSummaryService,
    PaymentsService,
  ],
  exports: [FinancialSummaryService],
})
export class FinanceModule {}
