import { pgTable, text, timestamp, boolean, integer, pgEnum, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums for candidate system
export const candidateStatusEnum = pgEnum('candidate_status', ['new', 'reviewing', 'contacted', 'rejected', 'hired']);

// Enums for credits system
export const transactionTypeEnum = pgEnum('transaction_type', ['subscription_grant', 'manual_grant', 'purchase', 'consumption']);
export const creditTypeEnum = pgEnum('credit_type', ['contact_lookup', 'export', 'general']);

// Enums for sourcing strategies
export const strategyStatusEnum = pgEnum('strategy_status', ['pending', 'executing', 'polling', 'completed', 'error']);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  lastLoginMethod: text("last_login_method"),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  activeOrganizationId: text("active_organization_id"),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  googleLink: text("google_link"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  metadata: text("metadata"),
  credits: integer("credits").default(0).notNull(),
});

export const member = pgTable("member", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  role: text("role").default("member").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const invitation = pgTable("invitation", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role"),
  status: text("status").default("pending").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  inviterId: text("inviter_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const organizationShareLink = pgTable(
  "organization_share_link",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at"),
    maxViews: integer("max_views"),
    viewCount: integer("view_count").default(0).notNull(),
    revokedAt: timestamp("revoked_at"),
    preset: text("preset"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastViewedAt: timestamp("last_viewed_at"),
  },
  (table) => ({
    uniqueTokenHash: unique().on(table.tokenHash),
  })
)

export const subscription = pgTable("subscription", {
  id: text("id").primaryKey(),
  plan: text("plan").notNull(),
  referenceId: text("reference_id").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  status: text("status").default("incomplete"),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  trialStart: timestamp("trial_start"),
  trialEnd: timestamp("trial_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  seats: integer("seats"),
});

export const search = pgTable("search", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  query: text("query").notNull(),
  params: text("params").notNull(),
  parseResponse: text("parse_response"), // JSON: v3 parse output (criteria + concepts)
  parseSchemaVersion: integer("parse_schema_version"),
  scoringModel: text("scoring_model"), // JSON: v3 scoring calculation output
  scoringModelVersion: text("scoring_model_version"),
  scoringPrompt: text("scoring_prompt"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  status: text("status").default("created").notNull(), // created, processing, completed, error
  taskId: text("task_id"),
  progress: integer("progress").default(0),
});

export const sourcingStrategies = pgTable("sourcing_strategies", {
  id: text("id").primaryKey(),
  searchId: text("search_id")
    .notNull()
    .references(() => search.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  apifyPayload: text("apify_payload").notNull(), // JSON: strategy params for external API
  status: strategyStatusEnum("status").default("pending").notNull(),
  taskId: text("task_id"), // External API task ID for polling
  workflowRunId: text("workflow_run_id"), // QStash workflow run ID
  candidatesFound: integer("candidates_found").default(0),
  error: text("error"), // Error message if failed
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const creditTransactions = pgTable("credit_transactions", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  type: transactionTypeEnum("type").notNull(),
  creditType: creditTypeEnum("credit_type").notNull(),
  amount: integer("amount").notNull(),
  balanceBefore: integer("balance_before").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  relatedEntityId: text("related_entity_id"),
  description: text("description").notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const stripeWebhookEvents = pgTable(
  "stripe_webhook_events",
  {
    id: text("id").primaryKey(),
    stripeEventId: text("stripe_event_id").notNull(),
    stripeEventType: text("stripe_event_type").notNull(),
    referenceId: text("reference_id"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    processedAt: timestamp("processed_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueStripeEventId: unique().on(table.stripeEventId),
  })
);

export const candidates = pgTable("candidates", {
  id: text("id").primaryKey(),
  linkedinUrl: text("linkedin_url").notNull().unique(),
  linkedinUsername: text("linkedin_username"),
  linkedinUrn: text("linkedin_urn"),
  fullName: text("full_name"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  headline: text("headline"),
  position: text("position"),
  summary: text("summary"),
  photoUrl: text("photo_url"),
  location: text("location"), // JSON: { city, country, linkedinText }
  locationText: text("location_text"), // Simple text location
  email: text("email"),
  isPremium: boolean("is_premium").default(false),
  followerCount: integer("follower_count"),
  connectionCount: integer("connection_count"),
  registeredAt: timestamp("registered_at"),
  topSkills: text("top_skills"),
  openToWork: boolean("open_to_work").default(false),
  hiring: boolean("hiring").default(false),
  currentPositions: text("current_positions"), // JSON: array of objects
  experiences: text("experiences"), // JSON: array of experience objects
  educations: text("educations"), // JSON: array of education objects
  certifications: text("certifications"), // JSON: array of certification objects
  recommendations: text("recommendations"), // JSON: array of recommendation objects
  skills: text("skills"), // JSON: array of strings
  languages: text("languages"), // JSON: array of language objects
  projects: text("projects"), // JSON: array of project objects
  publications: text("publications"), // JSON: array of publication objects
  featured: text("featured"), // JSON: featured object
  verified: boolean("verified").default(false),
  sourceData: text("source_data"), // JSON: full API response
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const searchCandidates = pgTable("search_candidates", {
  id: text("id").primaryKey(),
  searchId: text("search_id")
    .notNull()
    .references(() => search.id, { onDelete: "cascade" }),
  candidateId: text("candidate_id")
    .notNull()
    .references(() => candidates.id, { onDelete: "cascade" }),
  matchScore: integer("match_score"), // 0-100
  notes: text("notes"), // JSON: { pros: [], cons: [] } or free text
  scoringResult: text("scoring_result"), // JSON: v3 scoring result
  scoringVersion: text("scoring_version"),
  scoringUpdatedAt: timestamp("scoring_updated_at"),
  status: candidateStatusEnum("status").default('new'),
  sourceProvider: text("source_provider"), // strategy name or 'api'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => ({
  uniqueSearchCandidate: unique().on(table.searchId, table.candidateId),
}));

// Relations for Better Auth
export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  members: many(member),
  invitations: many(invitation),
  searches: many(search),
  creditTransactions: many(creditTransactions),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const organizationRelations = relations(organization, ({ many }) => ({
  members: many(member),
  invitations: many(invitation),
  searches: many(search),
  shareLinks: many(organizationShareLink),
  creditTransactions: many(creditTransactions),
}));

export const memberRelations = relations(member, ({ one }) => ({
  user: one(user, {
    fields: [member.userId],
    references: [user.id],
  }),
  organization: one(organization, {
    fields: [member.organizationId],
    references: [organization.id],
  }),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
  organization: one(organization, {
    fields: [invitation.organizationId],
    references: [organization.id],
  }),
  inviter: one(user, {
    fields: [invitation.inviterId],
    references: [user.id],
  }),
}));

export const organizationShareLinkRelations = relations(
  organizationShareLink,
  ({ one }) => ({
    organization: one(organization, {
      fields: [organizationShareLink.organizationId],
      references: [organization.id],
    }),
    createdByUser: one(user, {
      fields: [organizationShareLink.createdByUserId],
      references: [user.id],
    }),
  })
)

export const searchRelations = relations(search, ({ one, many }) => ({
  user: one(user, {
    fields: [search.userId],
    references: [user.id],
  }),
  organization: one(organization, {
    fields: [search.organizationId],
    references: [organization.id],
  }),
  searchCandidates: many(searchCandidates),
  sourcingStrategies: many(sourcingStrategies),
}));

export const sourcingStrategiesRelations = relations(sourcingStrategies, ({ one }) => ({
  search: one(search, {
    fields: [sourcingStrategies.searchId],
    references: [search.id],
  }),
}));

export const candidatesRelations = relations(candidates, ({ many }) => ({
  searchCandidates: many(searchCandidates),
}));

export const searchCandidatesRelations = relations(searchCandidates, ({ one }) => ({
  search: one(search, {
    fields: [searchCandidates.searchId],
    references: [search.id],
  }),
  candidate: one(candidates, {
    fields: [searchCandidates.candidateId],
    references: [candidates.id],
  }),
}));

export const creditTransactionsRelations = relations(creditTransactions, ({ one }) => ({
  organization: one(organization, {
    fields: [creditTransactions.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [creditTransactions.userId],
    references: [user.id],
  }),
}));
