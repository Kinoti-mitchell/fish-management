import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Alert, AlertDescription } from "./ui/alert";
import { 
  Users, Plus, Search, Filter, Eye, Edit, Trash2, 
  Shield, Key, Clock, CheckCircle, XCircle, 
  UserCheck, UserX, AlertTriangle, Activity,
  Mail, Phone, MapPin, Calendar, Lock, Unlock,
  Monitor, Smartphone, Globe
} from "lucide-react";
import { NavigationSection } from "../types";
import { supabase, handleSupabaseError, withRetry } from "../lib/supabaseClient";
import { toast } from "sonner";

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  phone?: string;
  is_active: boolean;
  last_login?: string;
  created_at: string;
  updated_at: string;
  sessions?: UserSession[];
}

interface UserSession {
  id: string;
  user_id: string;
  session_token: string;
  ip_address?: string;
  user_agent?: string;
  device_type?: 'desktop' | 'mobile' | 'tablet';
  location?: string;
  is_active: boolean;
  last_activity: string;
  expires_at: string;
  created_at: string;
}

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
  };
}

interface UserManagementProps {
  onNavigate: (section: NavigationSection, itemId?: string) => void;
}

// Dynamic role colors and icons - will be loaded from database
const getRoleColor = (roleName: string): string => {
  // Default colors for common roles, can be customized per role in database
  const defaultColors: { [key: string]: string } = {
    'admin': 'bg-red-100 text-red-800 border-red-200',
    'manager': 'bg-blue-100 text-blue-800 border-blue-200',
    'user': 'bg-gray-100 text-gray-800 border-gray-200'
  };
  return defaultColors[roleName.toLowerCase()] || 'bg-gray-100 text-gray-800 border-gray-200';
};

const getRoleIcon = (roleName: string) => {
  // Default icons for common roles, can be customized per role in database
  const defaultIcons: { [key: string]: any } = {
    'admin': Shield,
    'manager': Users,
    'user': Eye
  };
  return defaultIcons[roleName.toLowerCase()] || Eye;
};

// Generate secure random password
const generateSecurePassword = (): string => {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

// Hash password (in production, this should be done server-side)
const hashPassword = async (password: string): Promise<string> => {
  // This is a simple hash for demo purposes
  // In production, use bcrypt or similar on the server side
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "salt123");
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Send email with password (mock implementation)
const sendPasswordEmail = async (email: string, password: string, firstName: string): Promise<void> => {
  // This would integrate with your email service (SendGrid, AWS SES, etc.)
  try {
    // Mock API call to email service
    const emailPayload = {
      to: email,
      subject: "Your RioFish Account Credentials",
      template: "user-credentials",
      variables: {
        firstName,
        email,
        password,
        loginUrl: window.location.origin + "/login"
      }
    };

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log("Email sent to:", email, "with password:", password);
    
    // In production, make actual API call:
    // const response = await fetch('/api/send-email', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(emailPayload)
    // });
    
  } catch (error) {
    throw new Error("Failed to send password email");
  }
};

export default function UserManagement({ onNavigate }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [userSessions, setUserSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('users');
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  
  const [userForm, setUserForm] = useState({
    email: '',
    first_name: '',
    last_name: '',
    role: '',
    phone: '',
    is_active: true
  });

  const [passwordForm, setPasswordForm] = useState({
    new_password: '',
    confirm_password: ''
  });

  // Fetch users with sessions
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('profiles')
          .select(`
            *,
            sessions:user_sessions(
              id, session_token, ip_address, user_agent, 
              device_type, location, is_active, last_activity, 
              expires_at, created_at
            )
          `)
          .order('created_at', { ascending: false });
      });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      const errorMessage = handleSupabaseError(error, 'fetching users');
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Fetch audit logs
  const fetchAuditLogs = async () => {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('audit_logs')
          .select(`
            *,
            user:profiles!audit_logs_user_id_fkey(first_name, last_name, email)
          `)
          .order('created_at', { ascending: false })
          .limit(100);
      });

      if (error) throw error;
      setAuditLogs(data || []);
    } catch (error) {
      const errorMessage = handleSupabaseError(error, 'fetching audit logs');
      toast.error(errorMessage);
    }
  };

  // Fetch user sessions
  const fetchUserSessions = async (userId: string) => {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('user_sessions')
          .select('*')
          .eq('user_id', userId)
          .order('last_activity', { ascending: false });
      });

      if (error) throw error;
      setUserSessions(data || []);
    } catch (error) {
      const errorMessage = handleSupabaseError(error, 'fetching user sessions');
      toast.error(errorMessage);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchAuditLogs();
  }, []);

  // Create or update user
  const handleUserSubmit = async () => {
    try {
      if (!userForm.email || !userForm.first_name || !userForm.last_name) {
        toast.error('Please fill in all required fields');
        return;
      }

      setProcessingAction('saving');

      if (selectedUser) {
        // Update existing user
        const { error } = await withRetry(async () => {
          return await supabase
            .from('profiles')
            .update({
              email: userForm.email,
              first_name: userForm.first_name,
              last_name: userForm.last_name,
              role: userForm.role,
              phone: userForm.phone || null,
              is_active: userForm.is_active,
              updated_at: new Date().toISOString()
            })
            .eq('id', selectedUser.id);
        });

        if (error) throw error;
        toast.success('User updated successfully');
      } else {
        // Create new user with generated password
        const generatedPassword = generateSecurePassword();
        const hashedPassword = await hashPassword(generatedPassword);

        const { data: newUser, error } = await withRetry(async () => {
          return await supabase
            .from('profiles')
            .insert([{
              email: userForm.email,
              first_name: userForm.first_name,
              last_name: userForm.last_name,
              role: userForm.role,
              phone: userForm.phone || null,
              is_active: userForm.is_active,
              password_hash: hashedPassword,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }])
            .select()
            .single();
        });

        if (error) throw error;

        // Show success message with credentials
        toast.success(`User created successfully! Credentials: ${userForm.email} / ${generatedPassword}`);
        console.log('New user credentials:', {
          email: userForm.email,
          password: generatedPassword,
          role: userForm.role
        });
      }

      setIsUserDialogOpen(false);
      setSelectedUser(null);
      setUserForm({
        email: '',
        first_name: '',
        last_name: '',
        role: '',
        phone: '',
        is_active: true
      });
      fetchUsers();
    } catch (error) {
      const errorMessage = handleSupabaseError(error, 'saving user');
      toast.error(errorMessage);
    } finally {
      setProcessingAction(null);
    }
  };

  // Reset password
  const handlePasswordReset = async () => {
    try {
      if (!passwordForm.new_password || !passwordForm.confirm_password) {
        toast.error('Please fill in both password fields');
        return;
      }

      if (passwordForm.new_password !== passwordForm.confirm_password) {
        toast.error('Passwords do not match');
        return;
      }

      if (passwordForm.new_password.length < 8) {
        toast.error('Password must be at least 8 characters long');
        return;
      }

      setProcessingAction('resetting-password');

      const hashedPassword = await hashPassword(passwordForm.new_password);

      const { error } = await withRetry(async () => {
        return await supabase
          .from('profiles')
          .update({
            password_hash: hashedPassword,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedUser?.id);
      });

      if (error) throw error;

      // Show success message with new password
      toast.success(`Password reset successfully! New password: ${passwordForm.new_password}`);
      console.log('Password reset for user:', {
        email: selectedUser?.email,
        newPassword: passwordForm.new_password
      });

      // Invalidate all user sessions
      if (selectedUser) {
        await invalidateAllUserSessions(selectedUser.id);
      }

      setIsPasswordDialogOpen(false);
      setPasswordForm({ new_password: '', confirm_password: '' });
      setSelectedUser(null);
    } catch (error) {
      const errorMessage = handleSupabaseError(error, 'resetting password');
      toast.error(errorMessage);
    } finally {
      setProcessingAction(null);
    }
  };

  // Toggle user status
  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      setProcessingAction(`toggle-${userId}`);
      
      const { error } = await withRetry(async () => {
        return await supabase
          .from('profiles')
          .update({
            is_active: !currentStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);
      });

      if (error) throw error;

      // If deactivating user, invalidate all sessions
      if (currentStatus) {
        await invalidateAllUserSessions(userId);
      }

      toast.success(`User ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
      fetchUsers();
    } catch (error) {
      const errorMessage = handleSupabaseError(error, 'updating user status');
      toast.error(errorMessage);
    } finally {
      setProcessingAction(null);
    }
  };

  // Delete user
  const deleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      setProcessingAction(`delete-${userId}`);

      // First invalidate all sessions
      await invalidateAllUserSessions(userId);

      // Then delete user
      const { error } = await withRetry(async () => {
        return await supabase
          .from('profiles')
          .delete()
          .eq('id', userId);
      });

      if (error) throw error;
      toast.success('User deleted successfully');
      fetchUsers();
    } catch (error) {
      const errorMessage = handleSupabaseError(error, 'deleting user');
      toast.error(errorMessage);
    } finally {
      setProcessingAction(null);
    }
  };

  // Invalidate all user sessions
  const invalidateAllUserSessions = async (userId: string) => {
    try {
      const { error } = await withRetry(async () => {
        return await supabase
          .from('user_sessions')
          .update({ 
            is_active: false,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('is_active', true);
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error invalidating sessions:', error);
    }
  };

  // Invalidate specific session
  const invalidateSession = async (sessionId: string) => {
    try {
      setProcessingAction(`invalidate-${sessionId}`);

      const { error } = await withRetry(async () => {
        return await supabase
          .from('user_sessions')
          .update({ 
            is_active: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', sessionId);
      });

      if (error) throw error;
      toast.success('Session invalidated successfully');
      
      if (selectedUser) {
        await fetchUserSessions(selectedUser.id);
      }
    } catch (error) {
      const errorMessage = handleSupabaseError(error, 'invalidating session');
      toast.error(errorMessage);
    } finally {
      setProcessingAction(null);
    }
  };

  // Get device icon
  const getDeviceIcon = (deviceType?: string) => {
    switch (deviceType) {
      case 'mobile': return Smartphone;
      case 'tablet': return Smartphone;
      case 'desktop': return Monitor;
      default: return Globe;
    }
  };

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.last_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && user.is_active) ||
                         (statusFilter === 'inactive' && !user.is_active);
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Stats
  const stats = {
    totalUsers: users.length,
    activeUsers: users.filter(u => u.is_active).length,
    inactiveUsers: users.filter(u => !u.is_active).length,
    // Dynamic role statistics - count users by role
    roleStats: users.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    activeSessions: users.reduce((total, user) => {
      return total + (user.sessions?.filter(s => s.is_active).length || 0);
    }, 0)
  };

  const openUserDialog = (user?: User) => {
    if (user) {
      setSelectedUser(user);
      setUserForm({
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        phone: user.phone || '',
        is_active: user.is_active
      });
    } else {
      setSelectedUser(null);
      setUserForm({
        email: '',
        first_name: '',
        last_name: '',
        role: '',
        phone: '',
        is_active: true
      });
    }
    setIsUserDialogOpen(true);
  };

  const openPasswordDialog = (user: User) => {
    setSelectedUser(user);
    setPasswordForm({ new_password: '', confirm_password: '' });
    setIsPasswordDialogOpen(true);
  };

  const openSessionDialog = async (user: User) => {
    setSelectedUser(user);
    await fetchUserSessions(user.id);
    setIsSessionDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">User Management</h1>
          <p className="text-muted-foreground">Manage users, roles, sessions, and system access</p>
        </div>
        <Button 
          onClick={() => openUserDialog()}
          disabled={processingAction === 'saving'}
          className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium shadow-lg transition-all duration-200"
        >
          <Plus className="mr-2 h-4 w-4" />
          {processingAction === 'saving' ? 'Creating...' : 'Add User'}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="card-shadow hover:shadow-lg transition-all duration-200">
          <CardContent className="card-compact">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total Users</p>
                <p className="text-3xl font-bold text-blue-600">{stats.totalUsers}</p>
                <p className="text-xs text-muted-foreground">{stats.activeUsers} active</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-shadow hover:shadow-lg transition-all duration-200">
          <CardContent className="card-compact">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Active Sessions</p>
                <p className="text-3xl font-bold text-green-600">{stats.activeSessions}</p>
                <p className="text-xs text-muted-foreground">Live connections</p>
              </div>
              <div className="p-3 bg-green-100 rounded-xl">
                <Monitor className="h-8 w-8 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-shadow hover:shadow-lg transition-all duration-200">
          <CardContent className="card-compact">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Administrators</p>
                <p className="text-3xl font-bold text-red-600">{stats.roleStats.admin || 0}</p>
                <p className="text-xs text-muted-foreground">Full access</p>
              </div>
              <div className="p-3 bg-red-100 rounded-xl">
                <Shield className="h-8 w-8 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-shadow hover:shadow-lg transition-all duration-200">
          <CardContent className="card-compact">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Processors</p>
                <p className="text-3xl font-bold text-purple-600">{stats.roleStats.processor || 0}</p>
                <p className="text-xs text-muted-foreground">Processing team</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-xl">
                <Users className="h-8 w-8 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 bg-gray-100">
          <TabsTrigger value="users" className="font-medium data-[state=active]:bg-white">
            <Users className="h-4 w-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger value="audit" className="font-medium data-[state=active]:bg-white">
            <Activity className="h-4 w-4 mr-2" />
            Audit Logs
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6">
          {/* Filters */}
          <Card className="card-shadow">
            <CardContent className="card-compact">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-[200px]">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {Object.keys(stats.roleStats)
                      .filter((role) => role && role.trim() !== '')
                      .map((role) => (
                        <SelectItem key={role} value={role}>
                          {role.charAt(0).toUpperCase() + role.slice(1).replace('_', ' ')}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Users Table */}
          <Card className="card-shadow">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b">
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <Users className="h-5 w-5 text-blue-600" />
                User Directory
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-500 mt-4">Loading users...</p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
                  <p className="text-gray-500">No users match your current search criteria</p>
                </div>
              ) : (
                <div className="mobile-table-container">
                  <Table className="mobile-table">
                    <TableHeader>
                      <TableRow className="bg-gray-50/50">
                        <TableHead className="font-semibold text-gray-900">User Details</TableHead>
                        <TableHead className="font-semibold text-gray-900">Role</TableHead>
                        <TableHead className="font-semibold text-gray-900">Status</TableHead>
                        <TableHead className="font-semibold text-gray-900">Sessions</TableHead>
                        <TableHead className="font-semibold text-gray-900">Last Login</TableHead>
                        <TableHead className="font-semibold text-gray-900">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map(user => {
                        const RoleIcon = roleIcons[user.role];
                        const activeSessions = user.sessions?.filter(s => s.is_active).length || 0;
                        const isProcessing = processingAction?.includes(user.id);

                        return (
                          <TableRow key={user.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="font-medium">
                              <div>
                                <div className="font-semibold text-gray-900">
                                  {user.first_name} {user.last_name}
                                </div>
                                <div className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {user.email}
                                </div>
                                {user.phone && (
                                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {user.phone}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={`${roleColors[user.role]} font-medium text-sm px-3 py-1`}>
                                <RoleIcon className="w-3 h-3 mr-1" />
                                {user.role.replace('_', ' ').toUpperCase()}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={user.is_active ? "default" : "secondary"}
                                className={`font-medium text-sm px-3 py-1 ${
                                  user.is_active 
                                    ? 'bg-green-100 text-green-800 border-green-200' 
                                    : 'bg-red-100 text-red-800 border-red-200'
                                }`}
                              >
                                {user.is_active ? (
                                  <>
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Active
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="w-3 h-3 mr-1" />
                                    Inactive
                                  </>
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge 
                                  variant="outline"
                                  className={`font-medium text-xs px-2 py-1 ${
                                    activeSessions > 0 
                                      ? 'bg-green-100 text-green-800 border-green-200' 
                                      : 'bg-gray-100 text-gray-800 border-gray-200'
                                  }`}
                                >
                                  {activeSessions} active
                                </Badge>
                                {activeSessions > 0 && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => openSessionDialog(user)}
                                    className="h-6 px-2 text-xs"
                                    title="View sessions"
                                  >
                                    <Monitor className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {user.last_login ? (
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    {new Date(user.last_login).toLocaleDateString()}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">Never</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => openUserDialog(user)}
                                  disabled={isProcessing}
                                  className="h-8 transition-all duration-200"
                                  title="Edit user"
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => openPasswordDialog(user)}
                                  disabled={isProcessing || processingAction === 'resetting-password'}
                                  className="h-8 transition-all duration-200"
                                  title="Reset password"
                                >
                                  <Key className="w-3 h-3" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => toggleUserStatus(user.id, user.is_active)}
                                  disabled={isProcessing || processingAction === `toggle-${user.id}`}
                                  className={`h-8 transition-all duration-200 ${
                                    user.is_active 
                                      ? 'text-red-600 hover:bg-red-50' 
                                      : 'text-green-600 hover:bg-green-50'
                                  }`}
                                  title={user.is_active ? "Deactivate user" : "Activate user"}
                                >
                                  {processingAction === `toggle-${user.id}` ? (
                                    <div className="w-3 h-3 animate-spin rounded-full border border-current border-t-transparent" />
                                  ) : user.is_active ? (
                                    <UserX className="w-3 h-3" />
                                  ) : (
                                    <UserCheck className="w-3 h-3" />
                                  )}
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => deleteUser(user.id)}
                                  disabled={isProcessing || processingAction === `delete-${user.id}`}
                                  className="h-8 text-red-600 hover:bg-red-50 transition-all duration-200"
                                  title="Delete user"
                                >
                                  {processingAction === `delete-${user.id}` ? (
                                    <div className="w-3 h-3 animate-spin rounded-full border border-current border-t-transparent" />
                                  ) : (
                                    <Trash2 className="w-3 h-3" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Logs Tab */}
        <TabsContent value="audit" className="space-y-6">
          <Card className="card-shadow">
            <CardHeader className="bg-gradient-to-r from-green-50 to-blue-50 border-b">
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <Activity className="h-5 w-5 text-green-600" />
                System Audit Logs
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/50">
                      <TableHead className="font-semibold text-gray-900">User</TableHead>
                      <TableHead className="font-semibold text-gray-900">Action</TableHead>
                      <TableHead className="font-semibold text-gray-900">Table</TableHead>
                      <TableHead className="font-semibold text-gray-900">Record ID</TableHead>
                      <TableHead className="font-semibold text-gray-900">Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map(log => (
                      <TableRow key={log.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell>
                          <div>
                            <div className="font-medium text-gray-900">
                              {log.user ? `${log.user.first_name} ${log.user.last_name}` : 'System'}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {log.user?.email || 'system@riofish.com'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline"
                            className={`font-medium text-sm px-3 py-1 ${
                              log.action === 'INSERT' ? 'bg-green-100 text-green-800 border-green-200' :
                              log.action === 'UPDATE' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                              log.action === 'DELETE' ? 'bg-red-100 text-red-800 border-red-200' :
                              'bg-gray-100 text-gray-800 border-gray-200'
                            }`}
                          >
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                            {log.table_name}
                          </code>
                        </TableCell>
                        <TableCell>
                          {log.record_id ? (
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                              {log.record_id.substring(0, 8)}...
                            </code>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(log.created_at).toLocaleString()}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* User Dialog */}
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-gray-900">
              {selectedUser ? 'Edit User' : 'Add New User'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {!selectedUser && (
              <Alert>
                <Mail className="h-4 w-4" />
                <AlertDescription>
                  A secure password will be generated and displayed after user creation. Please save the credentials securely.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="first_name" className="text-sm font-medium text-gray-700">First Name *</Label>
                <Input
                  id="first_name"
                  value={userForm.first_name}
                  onChange={(e) => setUserForm({...userForm, first_name: e.target.value})}
                  className="mt-1"
                  disabled={processingAction === 'saving'}
                />
              </div>
              <div>
                <Label htmlFor="last_name" className="text-sm font-medium text-gray-700">Last Name *</Label>
                <Input
                  id="last_name"
                  value={userForm.last_name}
                  onChange={(e) => setUserForm({...userForm, last_name: e.target.value})}
                  className="mt-1"
                  disabled={processingAction === 'saving'}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                className="mt-1"
                disabled={processingAction === 'saving'}
              />
            </div>

            <div>
              <Label htmlFor="phone" className="text-sm font-medium text-gray-700">Phone Number</Label>
              <Input
                id="phone"
                value={userForm.phone}
                onChange={(e) => setUserForm({...userForm, phone: e.target.value})}
                className="mt-1"
                disabled={processingAction === 'saving'}
              />
            </div>

            <div>
              <Label htmlFor="role" className="text-sm font-medium text-gray-700">Role *</Label>
              <Select 
                value={userForm.role} 
                onValueChange={(value: User['role']) => setUserForm({...userForm, role: value})}
                disabled={processingAction === 'saving'}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(stats.roleStats)
                    .filter((role) => role && role.trim() !== '')
                    .map((role) => (
                      <SelectItem key={role} value={role}>
                        {role.charAt(0).toUpperCase() + role.slice(1).replace('_', ' ')}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_active"
                checked={userForm.is_active}
                onChange={(e) => setUserForm({...userForm, is_active: e.target.checked})}
                className="rounded border-gray-300"
                disabled={processingAction === 'saving'}
              />
              <Label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                Active user
              </Label>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => setIsUserDialogOpen(false)}
                disabled={processingAction === 'saving'}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleUserSubmit}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                disabled={!userForm.email || !userForm.first_name || !userForm.last_name || processingAction === 'saving'}
              >
                {processingAction === 'saving' ? (
                  <>
                    <div className="w-4 h-4 mr-2 animate-spin rounded-full border border-current border-t-transparent" />
                    {selectedUser ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  selectedUser ? 'Update User' : 'Create User'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Key className="h-5 w-5 text-blue-600" />
              Reset Password
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                Resetting password for: <strong>{selectedUser?.first_name} {selectedUser?.last_name}</strong>
              </p>
              <p className="text-xs text-blue-600 mt-1">
                New password will be displayed after reset. Please save it securely.
              </p>
            </div>

            <div>
              <Label htmlFor="new_password" className="text-sm font-medium text-gray-700">New Password *</Label>
              <Input
                id="new_password"
                type="password"
                value={passwordForm.new_password}
                onChange={(e) => setPasswordForm({...passwordForm, new_password: e.target.value})}
                className="mt-1"
                placeholder="Enter new password (min 8 characters)"
                disabled={processingAction === 'resetting-password'}
              />
            </div>

            <div>
              <Label htmlFor="confirm_password" className="text-sm font-medium text-gray-700">Confirm Password *</Label>
              <Input
                id="confirm_password"
                type="password"
                value={passwordForm.confirm_password}
                onChange={(e) => setPasswordForm({...passwordForm, confirm_password: e.target.value})}
                className="mt-1"
                placeholder="Confirm new password"
                disabled={processingAction === 'resetting-password'}
              />
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This will invalidate all existing user sessions and require them to log in again.
              </AlertDescription>
            </Alert>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => setIsPasswordDialogOpen(false)}
                disabled={processingAction === 'resetting-password'}
              >
                Cancel
              </Button>
              <Button 
                onClick={handlePasswordReset}
                className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                disabled={!passwordForm.new_password || !passwordForm.confirm_password || processingAction === 'resetting-password'}
              >
                {processingAction === 'resetting-password' ? (
                  <>
                    <div className="w-4 h-4 mr-2 animate-spin rounded-full border border-current border-t-transparent" />
                    Resetting...
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4 mr-2" />
                    Reset Password
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sessions Dialog */}
      <Dialog open={isSessionDialogOpen} onOpenChange={setIsSessionDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Monitor className="h-5 w-5 text-green-600" />
              Active Sessions - {selectedUser?.first_name} {selectedUser?.last_name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {userSessions.length === 0 ? (
              <div className="text-center py-8">
                <Monitor className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No active sessions found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {userSessions
                  .filter(session => session.is_active)
                  .map(session => {
                    const DeviceIcon = getDeviceIcon(session.device_type);
                    return (
                      <div key={session.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-gray-100 rounded-lg">
                            <DeviceIcon className="h-5 w-5 text-gray-600" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {session.device_type || 'Unknown Device'}
                            </div>
                            <div className="text-sm text-gray-500">
                              {session.ip_address} • {session.location || 'Unknown Location'}
                            </div>
                            <div className="text-xs text-gray-400">
                              Last activity: {new Date(session.last_activity).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => invalidateSession(session.id)}
                          disabled={processingAction === `invalidate-${session.id}`}
                          className="text-red-600 hover:bg-red-50 border-red-200"
                        >
                          {processingAction === `invalidate-${session.id}` ? (
                            <div className="w-4 h-4 animate-spin rounded-full border border-current border-t-transparent" />
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 mr-1" />
                              End Session
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
              </div>
            )}
            <div className="flex justify-end pt-4 border-t mt-4">
              <Button variant="outline" onClick={() => setIsSessionDialogOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}