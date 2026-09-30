import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type {
  OperationObject,
  ReferenceObject,
  SchemaObject,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

type Schema = SchemaObject | ReferenceObject;
const text: SchemaObject = { type: 'string' };
const bool: SchemaObject = { type: 'boolean' };
const integer: SchemaObject = { type: 'integer' };
const number: SchemaObject = { type: 'number' };
const id: SchemaObject = { type: 'string', format: 'uuid' };
const date: SchemaObject = { type: 'string', format: 'date-time' };
const ref = (name: string): ReferenceObject => ({
  $ref: '#/components/schemas/' + name,
});
const list = (items: Schema): SchemaObject => ({ type: 'array', items });
const enumeration = (...values: string[]): SchemaObject => ({
  type: 'string',
  enum: values,
});
const object = (
  properties: Record<string, Schema>,
  optional: string[] = [],
  strict = false,
): SchemaObject => ({
  type: 'object',
  properties,
  ...(Object.keys(properties).some((k) => !optional.includes(k))
    ? { required: Object.keys(properties).filter((k) => !optional.includes(k)) }
    : {}),
  ...(strict ? { additionalProperties: false } : {}),
});
const nullable = (schema: SchemaObject): SchemaObject => ({
  ...schema,
  nullable: true,
  ...(schema.enum ? { enum: [...schema.enum, null] } : {}),
});
const stage = enumeration(
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'CONSULTATION_BOOKED',
  'WON',
  'LOST',
);
const role = enumeration('BROKER', 'ADMIN');
const state = enumeration(
  'DRAFT',
  'SUBMITTED',
  'VALUATION_PENDING',
  'VALUATION_RECEIVED',
  'REPORT_READY',
  'ARCHIVED',
);

export const schemas: Record<string, SchemaObject> = {
  ConsentCopy: object({
    locale: enumeration('de-DE', 'en'),
    version: text,
    processing: text,
    newsletter: text,
  }),
  NewsletterToken: object(
    { token: { type: 'string', maxLength: 1024 } },
    [],
    true,
  ),
  NewsletterResult: object({ state: enumeration('CONFIRMED', 'WITHDRAWN') }),
  Problem: object(
    {
      type: text,
      title: text,
      status: integer,
      detail: { oneOf: [text, list(text)] },
      instance: text,
      code: text,
    },
    ['code'],
  ),
  Identity: object({ id, name: text, role }),
  AuthTokens: object({
    id,
    name: text,
    role,
    accessToken: text,
    expiresIn: integer,
    tokenType: enumeration('Bearer'),
  }),
  BrokerInvitation: object(
    {
      name: { type: 'string', minLength: 1, maxLength: 120 },
      email: { type: 'string', format: 'email', maxLength: 254 },
      locale: enumeration('de-DE', 'en'),
    },
    ['locale'],
    true,
  ),
  InvitationToken: object(
    { token: { type: 'string', maxLength: 1024 } },
    [],
    true,
  ),
  AcceptInvitation: object(
    {
      token: { type: 'string', maxLength: 1024 },
      password: { type: 'string', minLength: 12, maxLength: 128 },
    },
    [],
    true,
  ),
  ConsentEvidence: object({
    id,
    userId: nullable(text),
    consentType: enumeration('NEWSLETTER', 'TERMS', 'DATA_PROCESSING'),
    action: enumeration('GRANTED', 'WITHDRAWN'),
    source: text,
    occurredAt: date,
  }),
  PropertyRecord: object({
    id,
    address: ref('Address'),
    propertyType: enumeration('APARTMENT', 'HOUSE', 'LAND'),
    sizeSqm: number,
    condition: enumeration('NEW', 'GOOD', 'NEEDS_RENOVATION'),
    yearBuilt: integer,
    rooms: nullable(integer),
    features: list(text),
    sellingTimeline: text,
    sellerContact: ref('Contact'),
    locale: text,
    state,
    createdAt: date,
    updatedAt: date,
  }),
  ValuationRecord: object({
    id,
    provider: text,
    estimatedValue: number,
    lowRange: number,
    highRange: number,
    currency: text,
    isStale: bool,
    createdAt: date,
  }),
  UserSummary: object(
    {
      id,
      name: text,
      email: { type: 'string', format: 'email' },
      role,
      active: bool,
      invitation: nullable(
        object({
          id,
          expiresAt: date,
          acceptedAt: nullable(date),
          revokedAt: nullable(date),
        }),
      ),
    },
    ['invitation'],
  ),
  Address: object(
    {
      street: { type: 'string', minLength: 1, maxLength: 200 },
      postalCode: { type: 'string', pattern: '^\\d{5}$' },
      city: { type: 'string', minLength: 1, maxLength: 100 },
      country: enumeration('DE'),
    },
    ['country'],
    true,
  ),
  Contact: object(
    {
      name: { type: 'string', minLength: 1, maxLength: 120 },
      email: { type: 'string', format: 'email', maxLength: 254 },
      phone: { type: 'string', pattern: '^[+\\d\\s()-]{6,25}$' },
    },
    ['phone'],
    true,
  ),
  CreateProperty: object(
    {
      address: ref('Address'),
      propertyType: enumeration('APARTMENT', 'HOUSE', 'LAND'),
      sizeSqm: { type: 'number', minimum: 1, maximum: 1000000 },
      condition: enumeration('NEW', 'GOOD', 'NEEDS_RENOVATION'),
      yearBuilt: {
        type: 'integer',
        minimum: 1600,
        description: 'Maximum is the server current year plus five.',
      },
      rooms: { type: 'integer', minimum: 1, maximum: 100 },
      features: {
        type: 'array',
        maxItems: 6,
        items: enumeration(
          'BALCONY',
          'GARDEN',
          'PARKING',
          'ELEVATOR',
          'TERRACE',
          'BASEMENT',
        ),
      },
      sellingTimeline: enumeration(
        'ASAP',
        'THREE_MONTHS',
        'SIX_MONTHS',
        'EXPLORING',
      ),
      sellerContact: ref('Contact'),
      locale: enumeration('de-DE', 'en', 'en-GB'),
      dataProcessingConsent: { type: 'boolean', enum: [true] },
      newsletterOptIn: {
        type: 'boolean',
        default: false,
        description:
          'Optional separate consent; enrollment requires email confirmation.',
      },
    },
    ['rooms', 'features', 'sellingTimeline', 'locale', 'newsletterOptIn'],
    true,
  ),
  Login: object(
    {
      email: { type: 'string', format: 'email' },
      password: {
        type: 'string',
        minLength: 1,
        maxLength: 256,
        writeOnly: true,
      },
    },
    [],
    true,
  ),
  CreateUser: object(
    {
      email: { type: 'string', format: 'email' },
      name: { type: 'string', minLength: 1, maxLength: 120 },
      password: {
        type: 'string',
        minLength: 12,
        maxLength: 128,
        writeOnly: true,
      },
      role,
    },
    [],
    true,
  ),
  ActiveUser: object({ active: bool }, [], true),
  AssignLead: object({ brokerId: id }, [], true),
  UpdateLead: object(
    { stage, notes: { type: 'string', maxLength: 5000 } },
    ['stage', 'notes'],
    true,
  ),
  CreateSlot: object({ startsAt: date, endsAt: date }, [], true),
  CreateBooking: object({ slotId: id }, [], true),
  AssessmentCreated: object({ id, state }),
  AssessmentStatus: object({
    id,
    state,
    processingError: nullable(text),
    address: ref('Address'),
    locale: text,
    propertyType: enumeration('APARTMENT', 'HOUSE', 'LAND'),
    sizeSqm: number,
    createdAt: date,
    reviewedAt: nullable(date),
  }),
  ReportContent: object(
    {
      valueRange: object({
        low: number,
        high: number,
        currency: enumeration('EUR'),
      }),
      estimatedValue: number,
      provider: enumeration('PriceHubble', 'Sprengnetter'),
      asOf: {
        type: 'string',
        description: 'Provider effective date or timestamp.',
      },
      confidence: enumeration('HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'),
      explanationSource: enumeration('INTEGRATION_GATEWAY', 'FACTUAL_FALLBACK'),
      keyDrivers: object({ opportunities: list(text), risks: list(text) }),
      marketContext: text,
      recommendation: text,
      buyerPositioning: text,
      salesRoute: text,
      strategy: list(text),
      tier: enumeration('VALUE_SIGNAL', 'FULL'),
      locale: enumeration('de-DE', 'en', 'en-GB'),
      openPoints: list(text),
      reportId: id,
      fullReport: object({ available: bool }),
    },
    [
      'reportId',
      'fullReport',
      'recommendation',
      'buyerPositioning',
      'salesRoute',
      'strategy',
      'tier',
      'locale',
    ],
  ),
  ReportRecord: object({
    id,
    propertyId: id,
    tier: enumeration('VALUE_SIGNAL', 'FULL'),
    releaseState: enumeration(
      'DRAFT_INTERNAL',
      'SELLER_VISIBLE',
      'UNDER_BROKER_REVIEW',
      'RELEASED',
    ),
    payload: ref('ReportContent'),
    releasedByUserId: nullable(text),
    releasedAt: nullable(date),
    reviewedByUserId: nullable(text),
    reviewedAt: nullable(date),
    valuationId: nullable(text),
    createdAt: date,
    updatedAt: date,
  }),
  LeadRecord: object({
    id,
    propertyId: id,
    scoreBand: nullable(enumeration('HOT', 'WARM', 'COLD')),
    score: integer,
    scoreVersion: text,
    scoreReasons: list(object({ label: text, points: integer })),
    assignedToId: nullable(text),
    notes: text,
    reviewedByUserId: nullable(text),
    reviewedAt: nullable(date),
    stage,
    createdAt: date,
    updatedAt: date,
  }),
  PropertySummary: object({
    id,
    address: ref('Address'),
    sellerContact: ref('Contact'),
    propertyType: enumeration('APARTMENT', 'HOUSE', 'LAND'),
    sizeSqm: number,
    condition: enumeration('NEW', 'GOOD', 'NEEDS_RENOVATION'),
    yearBuilt: integer,
    rooms: nullable(integer),
    features: list(text),
    sellingTimeline: text,
    state,
    processingError: nullable(text),
    reports: list(ref('ReportRecord')),
  }),
  LeadDetail: {
    allOf: [ref('LeadRecord'), object({ property: ref('PropertySummary') })],
  },
  LeadPage: object({
    items: list(ref('LeadDetail')),
    total: integer,
    page: integer,
    pageSize: { type: 'integer', enum: [50] },
  }),
  Booking: object({
    id,
    propertyId: id,
    slotId: id,
    status: text,
    calendarEventId: nullable(text),
    createdAt: date,
  }),
  Slot: object({ id, brokerId: id, startsAt: date, endsAt: date }),
  AvailableSlot: object({
    id,
    startsAt: date,
    endsAt: date,
    broker: object({ name: text }),
  }),
  SellerBooking: object(
    {
      id,
      status: text,
      slot: nullable(
        object({
          startsAt: date,
          endsAt: date,
          broker: object({ name: text }),
        }),
      ),
    },
    ['slot'],
  ),
  BrokerBooking: {
    allOf: [
      ref('Booking'),
      object({
        slot: {
          allOf: [ref('Slot'), object({ broker: object({ name: text }) })],
        },
        property: object({
          address: ref('Address'),
          sellerContact: ref('Contact'),
        }),
      }),
    ],
  },
  Audit: object({
    id,
    actorId: text,
    action: text,
    entityType: text,
    entityId: text,
    metadata: { type: 'object', additionalProperties: true, nullable: true },
    timestamp: date,
  }),
  AdminOverview: object({
    users: list(ref('UserSummary')),
    leads: integer,
    pending: integer,
    notifications: list(object({ state: text, _count: integer })),
    audit: list(ref('Audit')),
    integrations: object({
      valuation: bool,
      calendar: bool,
      email: bool,
      workers: bool,
    }),
    scoring: object({
      version: text,
      hot: integer,
      warm: integer,
      rules: text,
    }),
  }),
};

type Contract = {
  response: Schema;
  body?: string;
  security?: 'session' | 'assessment' | 'property';
  summary: string;
  role?: string;
  intake?: boolean;
  query?: boolean;
  cursor?: boolean;
};
const contracts: Record<string, Contract> = {
  StaffInvitationsController_resend: {
    summary: 'Reissue an unused invitation and invalidate previous links',
    response: object({
      invitationId: id,
      expiresAt: date,
      state: enumeration('PENDING_VERIFICATION'),
      delivery: enumeration('QUEUED'),
    }),
    security: 'session',
    role: 'ADMIN',
  },
  PropertyRecordsController_property: {
    summary: 'Read an owned or assigned property without private credentials',
    response: ref('PropertyRecord'),
    security: 'property',
  },
  PropertyRecordsController_valuation: {
    summary: 'Read latest stored valuation and staleness flag',
    response: ref('ValuationRecord'),
    security: 'property',
  },
  PropertyRecordsController_list: {
    summary: 'List authorized properties with cursor pagination',
    response: object({
      data: list(
        object({
          id,
          address: ref('Address'),
          propertyType: enumeration('APARTMENT', 'HOUSE', 'LAND'),
          sizeSqm: number,
          state,
          locale: text,
          createdAt: date,
        }),
      ),
      nextCursor: nullable(text),
    }),
    security: 'session',
    cursor: true,
    role: 'Assigned BROKER or ADMIN',
  },
  StaffInvitationsController_invite: {
    summary:
      'Invite a broker; account remains inactive until email verification',
    body: 'BrokerInvitation',
    response: object({
      invitationId: id,
      expiresAt: date,
      state: enumeration('PENDING_VERIFICATION'),
      delivery: enumeration('QUEUED'),
    }),
    security: 'session',
    role: 'ADMIN',
  },
  StaffInvitationsController_revoke: {
    summary: 'Revoke an unused broker invitation',
    response: object({ ok: bool }),
    security: 'session',
    role: 'ADMIN',
  },
  StaffInvitationsController_inspect: {
    summary: 'Inspect a valid invitation without consuming it',
    body: 'InvitationToken',
    response: object({ name: text, email: text, expiresAt: date }),
  },
  StaffInvitationsController_accept: {
    summary: 'Verify invited email and choose a password; one-time capability',
    body: 'AcceptInvitation',
    response: object({ state: enumeration('VERIFIED') }),
  },
  RecordsController_users: {
    summary: 'List staff accounts without credentials',
    response: object({
      data: list(ref('UserSummary')),
      nextCursor: nullable(text),
    }),
    security: 'session',
    role: 'ADMIN',
    cursor: true,
  },
  RecordsController_audit: {
    summary: 'Read append-only audit history',
    response: object({ data: list(ref('Audit')), nextCursor: nullable(text) }),
    security: 'session',
    role: 'ADMIN',
    cursor: true,
  },
  RecordsController_consents: {
    summary:
      'Read consent evidence; brokers restricted to assigned property subjects',
    response: object({
      data: list(ref('ConsentEvidence')),
      nextCursor: nullable(text),
    }),
    security: 'session',
    role: 'ADMIN or assigned BROKER',
    cursor: true,
  },
  NewsletterController_copy: {
    summary: 'Versioned, localized consent copy',
    response: ref('ConsentCopy'),
  },
  NewsletterController_confirm: {
    summary: 'Consume a single-use newsletter confirmation token',
    response: ref('NewsletterResult'),
  },
  NewsletterController_unsubscribe: {
    summary: 'Withdraw newsletter consent without login',
    body: 'NewsletterToken',
    response: ref('NewsletterResult'),
  },
  HealthController_live: {
    response: object({ status: enumeration('ok') }),
    summary: 'Process liveness',
  },
  HealthController_ready: {
    response: object({ status: enumeration('ready') }),
    summary: 'Database readiness',
  },
  AuthController_login: {
    body: 'Login',
    response: ref('AuthTokens'),
    summary:
      'Sign in; returns short-lived JWT and sets HttpOnly access/refresh cookies',
  },
  AuthController_refresh: {
    response: ref('AuthTokens'),
    summary:
      'Rotate ve_refresh cookie; reuse revokes the entire session family',
  },
  AuthController_revoke: {
    response: object({ ok: bool }),
    summary: 'Revoke current token family and clear cookies',
  },
  AuthController_me: {
    response: ref('Identity'),
    security: 'session',
    summary: 'Current account identity',
  },
  AuthController_logout: {
    response: object({ ok: bool }),
    summary:
      'Revoke current session and clear cookie; idempotent when signed out',
  },
  PropertiesController_create: {
    body: 'CreateProperty',
    response: ref('AssessmentCreated'),
    intake: true,
    summary: 'Submit assessment; idempotency key and owner secret required',
  },
  PropertiesController_status: {
    response: ref('AssessmentStatus'),
    security: 'assessment',
    summary: 'Read owned assessment state',
  },
  PropertiesController_signal: {
    response: ref('ReportContent'),
    security: 'property',
    summary: 'Read seller-visible value signal; 404 while unavailable',
  },
  PropertiesController_full: {
    response: ref('ReportContent'),
    security: 'property',
    summary: 'Read released full report; 403 before broker release',
  },
  PropertiesController_leads: {
    response: ref('LeadPage'),
    security: 'session',
    query: true,
    summary: 'Search authorized leads before pagination',
    role: 'BROKER or ADMIN',
  },
  PropertiesController_update: {
    body: 'UpdateLead',
    response: ref('LeadRecord'),
    security: 'session',
    summary: 'Update assigned lead stage or notes',
    role: 'Assigned BROKER or ADMIN',
  },
  PropertiesController_review: {
    response: ref('LeadRecord'),
    security: 'session',
    summary: 'Record assigned lead review',
    role: 'Assigned BROKER or ADMIN',
  },
  PropertiesController_release: {
    response: object({ reportId: id, releaseState: enumeration('RELEASED') }),
    security: 'session',
    summary: 'Release ready full report after broker review',
    role: 'Assigned BROKER or ADMIN',
  },
  PropertiesController_retry: {
    response: object({ queued: bool }),
    security: 'session',
    summary: 'Request retry of failed valuation',
    role: 'Assigned BROKER or ADMIN',
  },
  AdminController_overview: {
    response: ref('AdminOverview'),
    security: 'session',
    role: 'ADMIN',
    summary:
      'Team, queue, audit and configuration presence (not provider health)',
  },
  AdminController_create: {
    body: 'CreateUser',
    response: object({ id, name: text, email: text, role }),
    security: 'session',
    role: 'ADMIN',
    summary: 'Create staff account',
  },
  AdminController_active: {
    body: 'ActiveUser',
    response: object({ id, active: bool }),
    security: 'session',
    role: 'ADMIN',
    summary: 'Activate/deactivate another staff account',
  },
  AdminController_assign: {
    body: 'AssignLead',
    response: ref('LeadRecord'),
    security: 'session',
    role: 'ADMIN',
    summary: 'Assign lead to active staff account',
  },
  BookingController_list: {
    response: list(ref('BrokerBooking')),
    security: 'session',
    role: 'BROKER or ADMIN',
    summary: 'List own broker bookings; admin sees all; maximum 100',
  },
  BookingController_slot: {
    body: 'CreateSlot',
    response: ref('Slot'),
    security: 'session',
    role: 'BROKER or ADMIN',
    summary:
      'Create own future nonoverlapping availability (maximum two hours)',
  },
  BookingController_slots: {
    response: object({ items: list(ref('AvailableSlot')) }),
    security: 'assessment',
    summary: 'List assigned broker availability; configured calendar required',
  },
  BookingController_book: {
    body: 'CreateBooking',
    response: ref('Booking'),
    security: 'assessment',
    summary: 'Reserve slot; confirmation awaits external calendar write',
  },
  BookingController_sellerBookings: {
    response: list(ref('SellerBooking')),
    security: 'assessment',
    summary: 'Read own booking states; maximum 10',
  },
  BookingController_cancel: {
    response: ref('SellerBooking'),
    security: 'assessment',
    summary:
      'Cancel the active consultation. Confirmed calendar events stay held until broker reconciliation.',
  },
  BookingController_reconcile: {
    response: object({ id, status: text }),
    security: 'session',
    role: 'BROKER or ADMIN',
    summary:
      'Release a cancelled confirmed slot after the broker has checked the external calendar. Does not call the calendar provider.',
  },
};

export function createApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Vision Estates API')
    .setVersion('1.0.0')
    .setDescription(
      'Staff auth uses short-lived JWT and rotating HttpOnly refresh cookies with reuse detection. Legacy sessions expire naturally. Seller access uses a private header. Vendor integrations may be unavailable.',
    )
    .addCookieAuth('ve_session', { type: 'apiKey', in: 'cookie' }, 'session')
    .addCookieAuth(
      've_access',
      { type: 'apiKey', in: 'cookie' },
      'accessCookie',
    )
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'bearer',
    )
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'x-assessment-token' },
      'assessment',
    )
    .build();
  const doc = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (c, m) => c + '_' + m,
  });
  doc.components = { ...doc.components, schemas };
  const seen = new Set<string>();
  for (const [path, item] of Object.entries(doc.paths)) {
    for (const [method, value] of Object.entries(item)) {
      if (!['get', 'post', 'patch', 'delete', 'put'].includes(method)) continue;
      const op = value as OperationObject;
      const c = contracts[op.operationId!];
      if (!c) throw new Error('Undocumented operation: ' + op.operationId);
      seen.add(op.operationId!);
      op.summary = c.summary;
      op.description = c.role
        ? 'Required role: ' + c.role + '. Server-side ownership applies.'
        : c.summary;
      op.security =
        c.security === 'property'
          ? [
              { assessment: [] },
              { bearer: [] },
              { accessCookie: [] },
              { session: [] },
            ]
          : c.security === 'session'
            ? [{ bearer: [] }, { accessCookie: [] }, { session: [] }]
            : c.security
              ? [{ [c.security]: [] }]
              : [];
      op.parameters = path.includes('{id}')
        ? [{ name: 'id', in: 'path', required: true, schema: id }]
        : [];
      if (c.query)
        op.parameters.push(
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 10000, default: 1 },
          },
          {
            name: 'q',
            in: 'query',
            schema: { type: 'string', maxLength: 120 },
            description:
              'Trimmed case-insensitive literal seller/address search.',
          },
          { name: 'stage', in: 'query', schema: stage },
        );
      if (c.cursor)
        op.parameters.push(
          {
            name: 'cursor',
            in: 'query',
            schema: { type: 'string', maxLength: 512 },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
          },
        );
      if (op.operationId === 'NewsletterController_copy')
        op.parameters.push({
          name: 'locale',
          in: 'query',
          schema: enumeration('de-DE', 'en', 'en-GB'),
        });
      if (op.operationId === 'NewsletterController_confirm')
        op.parameters.push({
          name: 'token',
          in: 'query',
          required: true,
          schema: { type: 'string', maxLength: 1024 },
        });
      if (c.intake)
        op.parameters.push(
          {
            name: 'idempotency-key',
            in: 'header',
            required: true,
            schema: { type: 'string', pattern: '^[\\w-]{16,100}$' },
          },
          {
            name: 'x-assessment-token',
            in: 'header',
            required: true,
            schema: { type: 'string', pattern: '^[a-f0-9]{64}$' },
          },
        );
      if (c.body)
        op.requestBody = {
          required: true,
          content: { 'application/json': { schema: ref(c.body) } },
        };
      else delete op.requestBody;
      const success = method === 'post' ? '201' : '200';
      op.responses = {
        [success]: {
          description: 'Success',
          content: { 'application/json': { schema: c.response } },
        },
      };
      for (const code of [
        '400',
        '403',
        '404',
        '409',
        '500',
        '503',
        ...(c.security === 'session' ? ['401'] : []),
        ...(method === 'post' || method === 'patch' ? ['429'] : []),
      ])
        op.responses[code] = {
          description: (
            {
              '400': 'Validation failed',
              '401': 'Sign in required',
              '403': 'Access denied',
              '404': 'Resource unavailable',
              '409': 'State or concurrency conflict',
              '429': 'Rate limited',
              '500': 'Unexpected failure',
              '503': 'Database or integration unavailable',
            } as Record<string, string>
          )[code],
          content: { 'application/problem+json': { schema: ref('Problem') } },
        };
      if (op.operationId === 'AuthController_login')
        op.responses['401'] = {
          description: 'Incorrect credentials',
          content: { 'application/problem+json': { schema: ref('Problem') } },
        };
    }
  }
  for (const key of Object.keys(contracts))
    if (!seen.has(key)) throw new Error('Contract without route: ' + key);
  return doc;
}

export function serveApiDocs(app: INestApplication) {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.API_DOCS_ENABLED !== 'true'
  )
    return;
  SwaggerModule.setup('docs', app, createApiDocument(app), {
    jsonDocumentUrl: 'v1/openapi.json',
    swaggerOptions: { supportedSubmitMethods: [] },
  });
}
