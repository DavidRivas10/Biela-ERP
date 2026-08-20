import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import {
  CommercialDocumentQueryDto,
  PayablesQueryDto,
  ReceivablesQueryDto,
} from "./dto/commercial-query.dto";

type SummaryRow = {
  documentCount: bigint;
  grossAmount: Prisma.Decimal;
  returnAmount: Prisma.Decimal;
  netAmount: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  refundedAmount: Prisma.Decimal;
  outstandingAmount: Prisma.Decimal;
  creditAmount: Prisma.Decimal;
  unpaidCount: bigint;
  partiallyPaidCount: bigint;
  paidCount: bigint;
  overdueCount: bigint;
  overdueAmount: Prisma.Decimal;
  oldestDueDate: Date | null;
};

@Injectable()
export class CommercialService {
  constructor(private readonly prisma: PrismaService) {}

  async customerAccount(customerId: string, query: CommercialDocumentQueryDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer) throw new NotFoundException("Customer not found");
    const account = await this.receivables({ ...query, customerId }, true);
    return { customer, ...account };
  }

  async supplierAccount(supplierId: string, query: CommercialDocumentQueryDto) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
    });
    if (!supplier) throw new NotFoundException("Supplier not found");
    const account = await this.payables({ ...query, supplierId }, true);
    return { supplier, ...account };
  }

  async receivables(query: ReceivablesQueryDto, includeSettled = false) {
    this.validateDates(query);
    const businessDate = this.businessDate();
    const base = this.receivableQuery(query, businessDate, includeSettled);
    const [data, summaries] = await Promise.all([
      this.prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
        ${base}
        SELECT
          "id", "number", "documentDate", "paymentDueDate", "customerId",
          "customer", "walkIn", "total", "paidAmount", "refundedAmount",
          "outstandingAmount", "settlementStatus", "overdue",
          CASE WHEN "overdue" THEN ${businessDate}::date - "paymentDueDate" ELSE 0 END AS "ageInDays"
        FROM filtered
        ORDER BY "overdue" DESC, "paymentDueDate" ASC NULLS LAST,
                 "documentDate" ASC, "number" ASC
        OFFSET ${(query.page - 1) * query.limit} LIMIT ${query.limit}
      `),
      this.prisma.$queryRaw<SummaryRow[]>(Prisma.sql`
        ${base}
        SELECT
          COUNT(*)::bigint AS "documentCount",
          COALESCE(SUM("total"), 0)::numeric AS "grossAmount",
          0::numeric AS "returnAmount",
          COALESCE(SUM("total"), 0)::numeric AS "netAmount",
          COALESCE(SUM("paidAmount"), 0)::numeric AS "paidAmount",
          COALESCE(SUM("refundedAmount"), 0)::numeric AS "refundedAmount",
          COALESCE(SUM("outstandingAmount"), 0)::numeric AS "outstandingAmount",
          0::numeric AS "creditAmount",
          COUNT(*) FILTER (WHERE "settlementStatus" = 'UNPAID')::bigint AS "unpaidCount",
          COUNT(*) FILTER (WHERE "settlementStatus" = 'PARTIALLY_PAID')::bigint AS "partiallyPaidCount",
          COUNT(*) FILTER (WHERE "settlementStatus" = 'PAID')::bigint AS "paidCount",
          COUNT(*) FILTER (WHERE "overdue")::bigint AS "overdueCount",
          COALESCE(SUM("outstandingAmount") FILTER (WHERE "overdue"), 0)::numeric AS "overdueAmount",
          MIN("paymentDueDate") FILTER (WHERE "outstandingAmount" > 0) AS "oldestDueDate"
        FROM filtered
      `),
    ]);
    return this.page(data, summaries[0], query);
  }

  async payables(query: PayablesQueryDto, includeSettled = false) {
    this.validateDates(query);
    const businessDate = this.businessDate();
    const base = this.payableQuery(query, businessDate, includeSettled);
    const [data, summaries] = await Promise.all([
      this.prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
        ${base}
        SELECT
          "id", "number", "documentDate", "paymentDueDate", "supplierId",
          "supplier", "grossPurchaseValue", "purchaseReturnValue",
          "netPurchaseObligation", "paidAmount", "supplierRefundedAmount",
          "netPaidAmount", "outstandingAmount", "supplierCreditAmount",
          "settlementStatus", "overdue",
          CASE WHEN "overdue" THEN ${businessDate}::date - "paymentDueDate" ELSE 0 END AS "ageInDays"
        FROM filtered
        ORDER BY "overdue" DESC, "paymentDueDate" ASC NULLS LAST,
                 "documentDate" ASC, "number" ASC
        OFFSET ${(query.page - 1) * query.limit} LIMIT ${query.limit}
      `),
      this.prisma.$queryRaw<SummaryRow[]>(Prisma.sql`
        ${base}
        SELECT
          COUNT(*)::bigint AS "documentCount",
          COALESCE(SUM("grossPurchaseValue"), 0)::numeric AS "grossAmount",
          COALESCE(SUM("purchaseReturnValue"), 0)::numeric AS "returnAmount",
          COALESCE(SUM("netPurchaseObligation"), 0)::numeric AS "netAmount",
          COALESCE(SUM("paidAmount"), 0)::numeric AS "paidAmount",
          COALESCE(SUM("supplierRefundedAmount"), 0)::numeric AS "refundedAmount",
          COALESCE(SUM("outstandingAmount"), 0)::numeric AS "outstandingAmount",
          COALESCE(SUM("supplierCreditAmount"), 0)::numeric AS "creditAmount",
          COUNT(*) FILTER (WHERE "settlementStatus" = 'UNPAID')::bigint AS "unpaidCount",
          COUNT(*) FILTER (WHERE "settlementStatus" = 'PARTIALLY_PAID')::bigint AS "partiallyPaidCount",
          COUNT(*) FILTER (WHERE "settlementStatus" = 'PAID')::bigint AS "paidCount",
          COUNT(*) FILTER (WHERE "overdue")::bigint AS "overdueCount",
          COALESCE(SUM("outstandingAmount") FILTER (WHERE "overdue"), 0)::numeric AS "overdueAmount",
          MIN("paymentDueDate") FILTER (WHERE "outstandingAmount" > 0) AS "oldestDueDate"
        FROM filtered
      `),
    ]);
    return this.page(data, summaries[0], query);
  }

  async summary() {
    const broad = { page: 1, limit: 1 };
    const [receivables, payables, cash] = await Promise.all([
      this.receivables(broad),
      this.payables(broad),
      this.prisma.$queryRaw<
        Array<{
          openSessionCount: bigint;
          expectedCash: Prisma.Decimal;
        }>
      >(Prisma.sql`
        SELECT
          COUNT(*)::bigint AS "openSessionCount",
          COALESCE(SUM(
            session_totals."openingAmount" + session_totals."movementTotal"
          ), 0)::numeric AS "expectedCash"
        FROM (
          SELECT cs."id", cs."openingAmount",
            COALESCE(SUM(CASE
              WHEN cm."type" IN (
                'SALE_PAYMENT', 'SALE_REFUND_REVERSAL',
                'PURCHASE_PAYMENT_REVERSAL', 'SUPPLIER_REFUND', 'MANUAL_IN'
              ) THEN cm."amount"
              ELSE -cm."amount"
            END), 0) AS "movementTotal"
          FROM "CashSession" cs
          LEFT JOIN "CashMovement" cm ON cm."cashSessionId" = cs."id"
          WHERE cs."status" = 'OPEN'
          GROUP BY cs."id", cs."openingAmount"
        ) session_totals
      `),
    ]);
    return {
      businessDate: this.businessDate(),
      receivables: receivables.summary,
      payables: payables.summary,
      cash: this.serialize({
        openSessionCount: cash[0].openSessionCount,
        expectedCash: cash[0].expectedCash,
      }),
    };
  }

  private receivableQuery(
    query: ReceivablesQueryDto,
    businessDate: string,
    includeSettled: boolean,
  ) {
    const staticConditions: Prisma.Sql[] = [Prisma.sql`s."status" = 'POSTED'`];
    if (query.customerId)
      staticConditions.push(
        Prisma.sql`s."customerId" = ${query.customerId}::uuid`,
      );
    this.dateConditions(staticConditions, query, "s");
    const derived = this.derivedConditions(
      query,
      includeSettled ? undefined : Prisma.sql`"outstandingAmount" > 0`,
    );
    return Prisma.sql`
      WITH payment_totals AS (
        SELECT "saleId",
          COALESCE(SUM("amount") FILTER (
            WHERE "type" = 'SALE_PAYMENT' AND "status" = 'POSTED'
          ), 0) AS paid,
          COALESCE(SUM("amount") FILTER (
            WHERE "type" = 'SALE_REFUND' AND "status" = 'POSTED'
          ), 0) AS refunded
        FROM "Payment" WHERE "saleId" IS NOT NULL GROUP BY "saleId"
      ), documents AS (
        SELECT s."id", s."number", s."documentDate", s."paymentDueDate",
          s."customerId", (s."customerId" IS NULL) AS "walkIn",
          CASE WHEN c."id" IS NULL THEN NULL ELSE jsonb_build_object(
            'id', c."id", 'code', c."code", 'name', c."name",
            'businessName', c."businessName", 'active', c."active"
          ) END AS customer,
          s."total" AS total,
          COALESCE(pt.paid, 0)::numeric AS "paidAmount",
          COALESCE(pt.refunded, 0)::numeric AS "refundedAmount",
          GREATEST(s."total" - COALESCE(pt.paid, 0), 0)::numeric AS "outstandingAmount"
        FROM "Sale" s
        LEFT JOIN "Customer" c ON c."id" = s."customerId"
        LEFT JOIN payment_totals pt ON pt."saleId" = s."id"
        WHERE ${Prisma.join(staticConditions, " AND ")}
      ), classified AS (
        SELECT *,
          CASE WHEN "outstandingAmount" = 0 THEN 'PAID'
            WHEN "paidAmount" = 0 THEN 'UNPAID'
            ELSE 'PARTIALLY_PAID' END AS "settlementStatus",
          ("outstandingAmount" > 0 AND "paymentDueDate" IS NOT NULL
            AND "paymentDueDate" < ${businessDate}::date) AS overdue
        FROM documents
      ), filtered AS (
        SELECT * FROM classified WHERE ${Prisma.join(derived, " AND ")}
      )
    `;
  }

  private payableQuery(
    query: PayablesQueryDto,
    businessDate: string,
    includeSettled: boolean,
  ) {
    const staticConditions: Prisma.Sql[] = [
      Prisma.sql`p."status" IN ('CONFIRMED', 'PARTIALLY_RECEIVED', 'RECEIVED')`,
    ];
    if (query.supplierId)
      staticConditions.push(
        Prisma.sql`p."supplierId" = ${query.supplierId}::uuid`,
      );
    this.dateConditions(staticConditions, query, "p");
    const derived = this.derivedConditions(
      query,
      includeSettled
        ? undefined
        : Prisma.sql`("outstandingAmount" > 0 OR "supplierCreditAmount" > 0)`,
    );
    return Prisma.sql`
      WITH returned_quantities AS (
        SELECT pri."purchaseItemId", SUM(pri."quantityReturned") AS quantity
        FROM "PurchaseReturnItem" pri
        JOIN "PurchaseReturn" pr ON pr."id" = pri."purchaseReturnId"
        WHERE pr."status" = 'POSTED'
        GROUP BY pri."purchaseItemId"
      ), return_values AS (
        SELECT pi."purchaseId",
          COALESCE(SUM(ROUND(
            pi."lineTotal" * COALESCE(rq.quantity, 0) / pi."orderedQuantity", 2
          )), 0) AS value
        FROM "PurchaseItem" pi
        LEFT JOIN returned_quantities rq ON rq."purchaseItemId" = pi."id"
        GROUP BY pi."purchaseId"
      ), payment_totals AS (
        SELECT "purchaseId",
          COALESCE(SUM("amount") FILTER (
            WHERE "type" = 'PURCHASE_PAYMENT' AND "status" = 'POSTED'
          ), 0) AS paid,
          COALESCE(SUM("amount") FILTER (
            WHERE "type" = 'SUPPLIER_REFUND' AND "status" = 'POSTED'
          ), 0) AS refunded
        FROM "Payment" WHERE "purchaseId" IS NOT NULL GROUP BY "purchaseId"
      ), values AS (
        SELECT p."id", p."number", p."documentDate", p."paymentDueDate",
          p."supplierId", jsonb_build_object(
            'id', s."id", 'code', s."code", 'businessName', s."businessName",
            'active', s."active"
          ) AS supplier,
          p."total" AS "grossPurchaseValue",
          LEAST(COALESCE(rv.value, 0), p."total")::numeric AS "purchaseReturnValue",
          GREATEST(p."total" - COALESCE(rv.value, 0), 0)::numeric AS "netPurchaseObligation",
          COALESCE(pt.paid, 0)::numeric AS "paidAmount",
          COALESCE(pt.refunded, 0)::numeric AS "supplierRefundedAmount",
          (COALESCE(pt.paid, 0) - COALESCE(pt.refunded, 0))::numeric AS "netPaidAmount"
        FROM "Purchase" p
        JOIN "Supplier" s ON s."id" = p."supplierId"
        LEFT JOIN return_values rv ON rv."purchaseId" = p."id"
        LEFT JOIN payment_totals pt ON pt."purchaseId" = p."id"
        WHERE ${Prisma.join(staticConditions, " AND ")}
      ), documents AS (
        SELECT *,
          GREATEST("netPurchaseObligation" - "netPaidAmount", 0)::numeric AS "outstandingAmount",
          GREATEST("netPaidAmount" - "netPurchaseObligation", 0)::numeric AS "supplierCreditAmount"
        FROM values
      ), classified AS (
        SELECT *,
          CASE WHEN "outstandingAmount" = 0 THEN 'PAID'
            WHEN "netPaidAmount" = 0 THEN 'UNPAID'
            ELSE 'PARTIALLY_PAID' END AS "settlementStatus",
          ("outstandingAmount" > 0 AND "paymentDueDate" IS NOT NULL
            AND "paymentDueDate" < ${businessDate}::date) AS overdue
        FROM documents
      ), filtered AS (
        SELECT * FROM classified WHERE ${Prisma.join(derived, " AND ")}
      )
    `;
  }

  private dateConditions(
    conditions: Prisma.Sql[],
    query: CommercialDocumentQueryDto,
    alias: string,
  ) {
    const column = (name: string) => Prisma.raw(`${alias}."${name}"`);
    if (query.dueFrom)
      conditions.push(
        Prisma.sql`${column("paymentDueDate")} >= ${query.dueFrom}::date`,
      );
    if (query.dueTo)
      conditions.push(
        Prisma.sql`${column("paymentDueDate")} <= ${query.dueTo}::date`,
      );
    if (query.documentFrom)
      conditions.push(
        Prisma.sql`${column("documentDate")} >= ${query.documentFrom}::date`,
      );
    if (query.documentTo)
      conditions.push(
        Prisma.sql`${column("documentDate")} <= ${query.documentTo}::date`,
      );
  }

  private derivedConditions(
    query: CommercialDocumentQueryDto,
    defaultCondition?: Prisma.Sql,
  ) {
    const conditions: Prisma.Sql[] = [Prisma.sql`TRUE`];
    if (query.settlementStatus)
      conditions.push(
        Prisma.sql`"settlementStatus" = ${query.settlementStatus}`,
      );
    else if (defaultCondition) conditions.push(defaultCondition);
    if (query.overdueOnly === true) conditions.push(Prisma.sql`overdue = TRUE`);
    if (query.overdueOnly === false)
      conditions.push(Prisma.sql`overdue = FALSE`);
    return conditions;
  }

  private validateDates(query: CommercialDocumentQueryDto) {
    for (const [from, to, label] of [
      [query.dueFrom, query.dueTo, "due date"],
      [query.documentFrom, query.documentTo, "document date"],
    ] as const)
      if (from && to && from > to)
        throw new BadRequestException(`Commercial ${label} range is invalid`);
  }

  private businessDate() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: process.env.TZ ?? "America/Tegucigalpa",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((value) => value.type === type)?.value;
    return `${part("year")}-${part("month")}-${part("day")}`;
  }

  private page(
    data: Array<Record<string, unknown>>,
    summary: SummaryRow,
    query: CommercialDocumentQueryDto,
  ) {
    const serializedSummary = this.serialize(summary) as Record<
      string,
      unknown
    >;
    const total = Number(summary.documentCount);
    return {
      data: this.serialize(data),
      summary: serializedSummary,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
      businessDate: this.businessDate(),
    };
  }

  private serialize(value: unknown): unknown {
    if (typeof value === "bigint") return Number(value);
    if (Prisma.Decimal.isDecimal(value)) return value.toFixed(2);
    if (Array.isArray(value)) return value.map((item) => this.serialize(item));
    if (value && typeof value === "object" && !(value instanceof Date))
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, this.serialize(item)]),
      );
    return value;
  }
}
