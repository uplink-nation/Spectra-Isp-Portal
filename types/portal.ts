export type CustomerPlan = {
  plan_id?: string;
  plan_name: string;
  speed_mbps: number;
  upload_speed_mbps: number;
  price_inr: number;
  data_limit_gb?: number | null; // null or undefined means Unlimited
  billing_cycle?: "monthly" | "quarterly" | "annual";
  renewal_date?: string;
  description?: string;
};

export type ISPPlan = {
  id: string;
  name: string;
  download_speed_mbps: number;
  upload_speed_mbps: number;
  price_inr: number;
  data_limit_gb?: number | null;
  billing_cycle?: "monthly" | "quarterly" | "annual";
  description?: string;
  is_popular?: boolean;
  tag?: string;
};

export type Customer = {
  id: string;
  name: string;
  pppoe_username: string;
  email?: string;
  phone?: string;
  address?: string;
  is_online?: boolean;
  last_status_change_at?: string;
  created_at?: string;
  plan?: CustomerPlan;
  plan_name?: string;
  plan_speed_mbps?: number;
  plan_upload_mbps?: number;
  plan_price_inr?: number;
  plan_data_limit_gb?: number | null;
  plan_renewal_date?: string;
};

export type DbCustomerWithStats = Customer & {
  email?: string;
  totalUsageBytes?: number;
  totalUsageFormatted?: string;
  totalInvoicesCount?: number;
  totalPendingInvoicesCount?: number;
  totalTicketsCount?: number;
  totalOpenTicketsCount?: number;
  totalSpeedTestsCount?: number;
  latestSpeedTestMbps?: number;
  latestSpeedTestPing?: number;
  totalSessionsCount?: number;
  is_online?: boolean;
  last_status_change_at?: string;
  status_text?: "ONLINE" | "OFFLINE";
};

export type InvoiceStatus = "paid" | "pending" | "overdue" | "cancelled";

export type Invoice = {
  id: string;
  customer_id: string;
  invoice_number: string;
  plan_name: string;
  period_start: string;
  period_end: string;
  issue_date: string;
  due_date: string;
  base_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  total_amount: number;
  status: InvoiceStatus;
  payment_method?: string | null;
  transaction_ref?: string | null;
  paid_at?: string | null;
  download_speed_mbps?: number;
  upload_speed_mbps?: number;
  customer_name?: string;
  pppoe_username?: string;
  created_at?: string;
};

export type TicketCategory =
  | "speed"
  | "disconnection"
  | "billing"
  | "router"
  | "relocation"
  | "general";

export type TicketPriority = "low" | "normal" | "urgent";
export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export type SupportTicket = {
  id: string;
  customer_id: string;
  ticket_code: string;
  category: TicketCategory;
  subject: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  contact_phone?: string | null;
  customer_name?: string;
  pppoe_username?: string;
  resolution_notes?: string | null;
  assigned_to?: string | null;
  created_at: string;
  updated_at?: string;
};

export type SpeedTestRecord = {
  id: string;
  customer_id: string;
  pppoe_username: string;
  customer_name?: string;
  download_mbps: number;
  upload_mbps: number;
  ping_ms: number;
  jitter_ms: number;
  server_name: string;
  server_location?: string | null;
  client_ip?: string | null;
  isp_name: string;
  grade: "A+" | "A" | "B" | "C";
  engine: string;
  created_at: string;
};

export type UsageSessionRecord = {
  id: string;
  customer_id: string;
  pppoe_username: string;
  customer_name?: string;
  session_started_at: string;
  session_ended_at: string | null;
  download_bytes: number;
  upload_bytes: number;
  total_bytes: number;
  created_at?: string;
};

export type CustomerOnlineStatus = "ONLINE" | "OFFLINE";

export type PresenceEntry = {
  customer_id: string;
  pppoe_username: string;
  is_online: boolean;
  status: CustomerOnlineStatus;
  last_status_change_at: string;
  telegram_message_id?: number | null;
  telegram_chat_id?: number | null;
  updated_at: string;
};

export type CustomerStatusRecord = {
  id: string;
  customer_id: string;
  customer_name?: string;
  pppoe_username: string;
  status: CustomerOnlineStatus;
  event_time: string;
  telegram_chat_id?: number | null;
  telegram_message_id?: number | null;
  created_at: string;
};
