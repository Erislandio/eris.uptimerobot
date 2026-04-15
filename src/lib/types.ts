export type MonitorStatus = 'active' | 'paused' | 'error'
export type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface Monitor {
  id: string
  user_id: string
  name: string
  url: string
  method: HttpMethod
  headers: Record<string, string>
  body: string | null
  interval_seconds: number
  retry_count: number
  timeout_seconds: number
  status: MonitorStatus
  last_triggered_at: string | null
  next_trigger_at: string | null
  created_at: string
  updated_at: string
}

export interface MonitorLog {
  id: string
  monitor_id: string
  status_code: number | null
  response_time_ms: number | null
  success: boolean
  error_message: string | null
  triggered_at: string
}

export interface MonitorWithLogs extends Monitor {
  monitor_logs: MonitorLog[]
}
