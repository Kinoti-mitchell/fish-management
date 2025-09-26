import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { 
  ChevronDown, ChevronRight, Search, Filter, User, 
  Activity, Calendar, Clock, Eye, EyeOff, Users,
  Database, FileText, AlertCircle, CheckCircle, XCircle
} from "lucide-react";
import { supabase, handleSupabaseError, withRetry } from "../lib/supabaseClient";
import { toast } from "sonner";

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  table_name: string;
  record_id?: string;
  old_values?: any;
  new_values?: any;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  user?: {
    first_name: string;
    last_name: string;
    email: string;
    role: string;
  };
}

interface UserWithLogs {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  last_login?: string;
  audit_logs: AuditLog[];
  total_activities: number;
}

interface AuditLogsViewProps {
  onNavigate?: (section: string, itemId?: string) => void;
}

function AuditLogsView({ onNavigate }: AuditLogsViewProps) {
  const [usersWithLogs, setUsersWithLogs] = useState<UserWithLogs[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [showInactiveUsers, setShowInactiveUsers] = useState(false);

  // Fetch all users and their audit logs
  const fetchUsersWithLogs = async () => {
    try {
      setLoading(true);
      
      // First, get all users
      const { data: users, error: usersError } = await withRetry(async () => {
        return await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });
      });

      if (usersError) throw usersError;

      // Then get all audit logs
      const { data: auditLogs, error: logsError } = await withRetry(async () => {
        return await supabase
          .from('audit_logs')
          .select(`
            *,
            user:profiles!audit_logs_user_id_fkey(first_name, last_name, email, role)
          `)
          .order('created_at', { ascending: false })
          .limit(1000); // Get more logs for better user activity tracking
      });

      if (logsError) throw logsError;

      // Group audit logs by user
      const logsByUser = new Map<string, AuditLog[]>();
      (auditLogs || []).forEach(log => {
        if (log.user_id) {
          if (!logsByUser.has(log.user_id)) {
            logsByUser.set(log.user_id, []);
          }
          logsByUser.get(log.user_id)!.push(log);
        }
      });

      // Combine users with their audit logs
      const usersWithLogsData: UserWithLogs[] = (users || []).map(user => ({
        ...user,
        audit_logs: logsByUser.get(user.id) || [],
        total_activities: logsByUser.get(user.id)?.length || 0
      }));

      setUsersWithLogs(usersWithLogsData);
    } catch (error) {
      const errorMessage = handleSupabaseError(error, 'fetching audit logs');
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersWithLogs();
  }, []);

  // Filter users based on search and filters
  const filteredUsers = usersWithLogs.filter(user => {
    const matchesSearch = searchTerm === '' || 
      user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesActivity = showInactiveUsers || user.total_activities > 0;
    
    return matchesSearch && matchesRole && matchesActivity;
  });

  // Filter audit logs for a specific user
  const getFilteredUserLogs = (logs: AuditLog[]) => {
    if (actionFilter === 'all') return logs;
    return logs.filter(log => log.action === actionFilter);
  };

  // Toggle user expansion
  const toggleUserExpansion = (userId: string) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedUsers(newExpanded);
  };

  // Get action badge color
  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'INSERT':
      case 'CREATE':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'UPDATE':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'DELETE':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'LOGIN':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'LOGOUT':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Get user initials
  const getUserInitials = (user: UserWithLogs) => {
    return `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Audit Logs</h2>
          <p className="text-gray-600">Track user activities and system changes</p>
        </div>
        <Button onClick={fetchUsersWithLogs} variant="outline" size="sm">
          <Activity className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="operator">Operator</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>

            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="INSERT">Create</SelectItem>
                <SelectItem value="UPDATE">Update</SelectItem>
                <SelectItem value="DELETE">Delete</SelectItem>
                <SelectItem value="LOGIN">Login</SelectItem>
                <SelectItem value="LOGOUT">Logout</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant={showInactiveUsers ? "default" : "outline"}
              onClick={() => setShowInactiveUsers(!showInactiveUsers)}
              className="flex items-center gap-2"
            >
              {showInactiveUsers ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showInactiveUsers ? "Hide Inactive" : "Show Inactive"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <div className="space-y-4">
        {filteredUsers.map((user) => {
          const isExpanded = expandedUsers.has(user.id);
          const filteredLogs = getFilteredUserLogs(user.audit_logs);
          
          return (
            <Card key={user.id} className="overflow-hidden">
              <Collapsible open={isExpanded} onOpenChange={() => toggleUserExpansion(user.id)}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                          {getUserInitials(user)}
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {user.first_name} {user.last_name}
                          </h3>
                          <p className="text-sm text-gray-600">{user.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {user.role}
                            </Badge>
                            <Badge 
                              variant={user.is_active ? "default" : "secondary"}
                              className={`text-xs ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
                            >
                              {user.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-2xl font-bold text-blue-600">
                            {user.total_activities}
                          </div>
                          <div className="text-sm text-gray-500">Activities</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-500">Last Activity</div>
                          <div className="text-sm font-medium">
                            {user.audit_logs.length > 0 
                              ? formatDate(user.audit_logs[0].created_at)
                              : 'Never'
                            }
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="pt-0">
                    {filteredLogs.length > 0 ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                          <Database className="h-4 w-4" />
                          Showing {filteredLogs.length} of {user.audit_logs.length} activities
                        </div>
                        
                        {filteredLogs.map((log) => (
                          <div key={log.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-xs">
                                  <Activity className="h-4 w-4" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge className={`text-xs ${getActionBadgeColor(log.action)}`}>
                                      {log.action}
                                    </Badge>
                                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                                      {log.table_name}
                                    </code>
                                  </div>
                                  <p className="text-sm text-gray-700 mb-2">
                                    {log.action === 'INSERT' && 'Created new record'}
                                    {log.action === 'UPDATE' && 'Updated record'}
                                    {log.action === 'DELETE' && 'Deleted record'}
                                    {log.action === 'LOGIN' && 'Logged into system'}
                                    {log.action === 'LOGOUT' && 'Logged out of system'}
                                    {!['INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT'].includes(log.action) && `Performed ${log.action} action`}
                                  </p>
                                  {log.record_id && (
                                    <p className="text-xs text-gray-500">
                                      Record ID: {log.record_id}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                  <Clock className="h-3 w-3" />
                                  {formatDate(log.created_at)}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Activity className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p>No activities found for this user</p>
                        {actionFilter !== 'all' && (
                          <p className="text-sm">Try changing the action filter</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>

      {filteredUsers.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No users found</h3>
            <p className="text-gray-600">Try adjusting your search or filter criteria</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default AuditLogsView;
