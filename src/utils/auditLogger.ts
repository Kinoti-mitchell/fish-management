import { supabase } from '../lib/supabaseClient';
import { createClient } from '@supabase/supabase-js';

export interface AuditLogData {
  action: string;
  table_name: string;
  record_id?: string;
  old_values?: any;
  new_values?: any;
  ip_address?: string;
  user_agent?: string;
}

/**
 * Centralized audit logging utility
 * Logs all system activities for compliance and tracking
 */
export class AuditLogger {
  /**
   * Log an audit event
   */
  static async logEvent(data: AuditLogData): Promise<void> {
    try {
      // Get current user from session storage (custom auth system)
      const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
      
      if (!currentUser) {
        console.warn('No authenticated user found for audit logging');
        return; // Skip logging if no authenticated user
      }
      
      const auditData = {
        user_id: currentUser.id,
        action: data.action,
        table_name: data.table_name,
        record_id: data.record_id,
        old_values: data.old_values ? JSON.stringify(data.old_values) : null,
        new_values: data.new_values ? JSON.stringify(data.new_values) : null,
        ip_address: data.ip_address || null,
        user_agent: data.user_agent || navigator.userAgent,
        created_at: new Date().toISOString()
      };
      
      // Use service client for audit logging to bypass RLS
      const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
      let error = null;
      
      if (serviceKey) {
        const serviceClient = createClient(import.meta.env.VITE_SUPABASE_URL, serviceKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false
          }
        });
        const result = await serviceClient
          .from('audit_logs')
          .insert([auditData]);
        error = result.error;
      } else {
        // Fallback to regular client if service key not available
        const result = await supabase
          .from('audit_logs')
          .insert([auditData]);
        error = result.error;
      }
      
      if (error) {
        console.warn('Failed to log audit event:', error);
      }
    } catch (error) {
      console.warn('Failed to log audit event:', error);
    }
  }

  /**
   * Log a CREATE operation
   */
  static async logCreate(tableName: string, recordId: string, newValues: any): Promise<void> {
    await AuditLogger.logEvent({
      action: 'CREATE',
      table_name: tableName,
      record_id: recordId,
      new_values: newValues
    });
  }

  /**
   * Log an UPDATE operation
   */
  static async logUpdate(tableName: string, recordId: string, oldValues: any, newValues: any): Promise<void> {
    await AuditLogger.logEvent({
      action: 'UPDATE',
      table_name: tableName,
      record_id: recordId,
      old_values: oldValues,
      new_values: newValues
    });
  }

  /**
   * Log a DELETE operation
   */
  static async logDelete(tableName: string, recordId: string, oldValues: any): Promise<void> {
    await AuditLogger.logEvent({
      action: 'DELETE',
      table_name: tableName,
      record_id: recordId,
      old_values: oldValues
    });
  }

  /**
   * Log a LOGIN operation
   */
  static async logLogin(userId: string, userAgent?: string): Promise<void> {
    await AuditLogger.logEvent({
      action: 'LOGIN',
      table_name: 'profiles',
      record_id: userId,
      new_values: { login_time: new Date().toISOString() },
      user_agent: userAgent
    });
  }

  /**
   * Log a LOGOUT operation
   */
  static async logLogout(userId: string): Promise<void> {
    await AuditLogger.logEvent({
      action: 'LOGOUT',
      table_name: 'profiles',
      record_id: userId,
      new_values: { logout_time: new Date().toISOString() }
    });
  }

  /**
   * Log a CUSTOM action (for business-specific operations)
   */
  static async logCustomAction(action: string, tableName: string, recordId?: string, details?: any): Promise<void> {
    await AuditLogger.logEvent({
      action: action,
      table_name: tableName,
      record_id: recordId,
      new_values: details
    });
  }
}

// Convenience functions for common operations
export const auditLog = {
  create: AuditLogger.logCreate,
  update: AuditLogger.logUpdate,
  delete: AuditLogger.logDelete,
  login: AuditLogger.logLogin,
  logout: AuditLogger.logLogout,
  custom: AuditLogger.logCustomAction
};
