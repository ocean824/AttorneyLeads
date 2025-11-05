/**
 * Role-Based Access Control (RBAC) Configuration
 * 
 * Defines roles and permissions for multi-user scenarios.
 * Currently not enforced but provides structure for future implementation.
 */

export enum Role {
  ADMIN = "admin",
  ATTORNEY = "attorney",
  INTAKE_SPECIALIST = "intake_specialist",
  VIEWER = "viewer",
}

export enum Permission {
  // Scraping
  VIEW_SCRAPING_JOBS = "view_scraping_jobs",
  START_SCRAPING_JOB = "start_scraping_job",
  CANCEL_SCRAPING_JOB = "cancel_scraping_job",

  // Records
  VIEW_ARREST_RECORDS = "view_arrest_records",
  EDIT_ARREST_RECORDS = "edit_arrest_records",
  DELETE_ARREST_RECORDS = "delete_arrest_records",
  EXPORT_ARREST_RECORDS = "export_arrest_records",

  // Duplicates
  VIEW_DUPLICATES = "view_duplicates",
  MERGE_DUPLICATES = "merge_duplicates",
  DISMISS_DUPLICATES = "dismiss_duplicates",
  SCAN_DUPLICATES = "scan_duplicates",

  // CRM
  VIEW_CRM_PROSPECTS = "view_crm_prospects",
  CREATE_CRM_PROSPECTS = "create_crm_prospects",
  EDIT_CRM_PROSPECTS = "edit_crm_prospects",
  DELETE_CRM_PROSPECTS = "delete_crm_prospects",

  // CRM Discovery
  LAUNCH_PROSPECT_DISCOVERY = "launch_prospect_discovery",
  VIEW_CAMPAIGNS = "view_campaigns",
  CREATE_CAMPAIGNS = "create_campaigns",

  // Meetings
  VIEW_MEETINGS = "view_meetings",
  SCHEDULE_MEETINGS = "schedule_meetings",
  CANCEL_MEETINGS = "cancel_meetings",

  // Analytics
  VIEW_ANALYTICS = "view_analytics",
  VIEW_STATS = "view_stats",

  // Integrations
  SYNC_GOOGLE_SHEETS = "sync_google_sheets",
  CONFIGURE_INTEGRATIONS = "configure_integrations",

  // Admin
  MANAGE_USERS = "manage_users",
  VIEW_SYSTEM_LOGS = "view_system_logs",
  CONFIGURE_SETTINGS = "configure_settings",
}

/**
 * Role-Permission Matrix
 */
export const rolePermissions: Record<Role, Permission[]> = {
  [Role.ADMIN]: [
    // All permissions
    ...Object.values(Permission),
  ],

  [Role.ATTORNEY]: [
    // Scraping
    Permission.VIEW_SCRAPING_JOBS,
    Permission.START_SCRAPING_JOB,

    // Records
    Permission.VIEW_ARREST_RECORDS,
    Permission.EDIT_ARREST_RECORDS,
    Permission.EXPORT_ARREST_RECORDS,

    // Duplicates
    Permission.VIEW_DUPLICATES,
    Permission.MERGE_DUPLICATES,
    Permission.DISMISS_DUPLICATES,
    Permission.SCAN_DUPLICATES,

    // CRM
    Permission.VIEW_CRM_PROSPECTS,
    Permission.CREATE_CRM_PROSPECTS,
    Permission.EDIT_CRM_PROSPECTS,

    // Meetings
    Permission.VIEW_MEETINGS,
    Permission.SCHEDULE_MEETINGS,

    // Analytics
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_STATS,

    // Integrations (limited)
    Permission.SYNC_GOOGLE_SHEETS,
  ],

  [Role.INTAKE_SPECIALIST]: [
    // Scraping (view only)
    Permission.VIEW_SCRAPING_JOBS,

    // Records
    Permission.VIEW_ARREST_RECORDS,
    Permission.EXPORT_ARREST_RECORDS,

    // Duplicates
    Permission.VIEW_DUPLICATES,
    Permission.MERGE_DUPLICATES,
    Permission.DISMISS_DUPLICATES,

    // CRM (full access)
    Permission.VIEW_CRM_PROSPECTS,
    Permission.CREATE_CRM_PROSPECTS,
    Permission.EDIT_CRM_PROSPECTS,
    Permission.LAUNCH_PROSPECT_DISCOVERY,
    Permission.VIEW_CAMPAIGNS,

    // Meetings (full access)
    Permission.VIEW_MEETINGS,
    Permission.SCHEDULE_MEETINGS,
    Permission.CANCEL_MEETINGS,

    // Analytics (view only)
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_STATS,

    // Integrations
    Permission.SYNC_GOOGLE_SHEETS,
  ],

  [Role.VIEWER]: [
    // Read-only access
    Permission.VIEW_SCRAPING_JOBS,
    Permission.VIEW_ARREST_RECORDS,
    Permission.VIEW_DUPLICATES,
    Permission.VIEW_CRM_PROSPECTS,
    Permission.VIEW_CAMPAIGNS,
    Permission.VIEW_MEETINGS,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_STATS,
  ],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(role, permission));
}

/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(role: Role, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(role, permission));
}

/**
 * Get all permissions for a role
 */
export function getPermissions(role: Role): Permission[] {
  return rolePermissions[role] || [];
}

/**
 * Permission middleware (future implementation)
 * 
 * Usage example:
 * ```typescript
 * import { requirePermission } from '@/config/permissions';
 * 
 * app.delete('/api/records/:id', requirePermission(Permission.DELETE_ARREST_RECORDS), async (req, res) => {
 *   // Only users with delete permission can access this route
 * });
 * ```
 */
export function requirePermission(permission: Permission) {
  return (req: any, res: any, next: any) => {
    // Future: Get user role from session/JWT
    const userRole = req.session?.user?.role || Role.VIEWER;
    
    if (!hasPermission(userRole, permission)) {
      return res.status(403).json({
        error: "Forbidden",
        message: `You don't have permission to perform this action`,
        requiredPermission: permission,
      });
    }
    
    next();
  };
}

/**
 * Example usage:
 * 
 * ```typescript
 * import { hasPermission, Role, Permission } from '@/config/permissions';
 * 
 * // Check if attorney can delete records
 * const canDelete = hasPermission(Role.ATTORNEY, Permission.DELETE_ARREST_RECORDS); // false
 * 
 * // Check if admin can delete records
 * const adminCanDelete = hasPermission(Role.ADMIN, Permission.DELETE_ARREST_RECORDS); // true
 * 
 * // Get all permissions for intake specialist
 * const intakePermissions = getPermissions(Role.INTAKE_SPECIALIST);
 * ```
 */
