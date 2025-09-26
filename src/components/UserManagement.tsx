import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Alert, AlertDescription } from "./ui/alert";
import { Textarea } from "./ui/textarea";
import { 
  Users, Plus, Search, Filter, Eye, Edit, Trash2, 
  Shield, Key, Clock, CheckCircle, XCircle, 
  UserCheck, UserX, AlertTriangle, Activity,
  Mail, Phone, MapPin, Calendar, Lock, Unlock,
  Monitor, Smartphone, Globe, Info, Settings,
  Briefcase, Tractor, Building, Building2, Package, Crown,
  Warehouse, Thermometer, Droplets, Archive,
  RefreshCw, User
} from "lucide-react";
import { NavigationSection } from "../types";
import { supabase, handleSupabaseError, withRetry } from "../lib/supabaseClient";
import { toast } from "sonner";
import { auditLog } from "../utils/auditLogger";
import { RioFishLogo } from "./RioFishLogo";
import { PermissionsDropdown } from "./PermissionsDropdown";
import { UserPermissionsView } from "./UserPermissionsView";

interface UserRole {
  id: string;
  name: string;
  display_name: string;
  description: string;
  permissions: string[];
  icon: string;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

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
  role_info?: UserRole;
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

interface EmailConfig {
  provider: 'sendgrid' | 'ses' | 'smtp' | 'resend';
  from_email: string;
  from_name: string;
  api_key: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_username?: string;
  smtp_pass?: string;
}

interface StorageLocation {
  id: string;
  name: string;
  description?: string;
  location_type: 'cold_storage' | 'freezer' | 'ambient' | 'processing_area';
  capacity_kg: number;
  current_usage_kg: number;
  temperature_celsius?: number;
  humidity_percent?: number;
  status: 'active' | 'maintenance' | 'inactive';
  created_at: string;
  updated_at: string;
}

interface Outlet {
  id: string;
  name: string;
  location: string;
  phone: string;
  manager_name?: string;
  manager_id?: string;
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
  updated_at: string;
}

interface Farmer {
  id: string;
  name: string;
  phone: string;
  location: string;
  rating: number;
  reliability: string;
  status: string;
  average_fish_size?: number;
  created_at: string;
  updated_at: string;
}

interface UserManagementProps {
  onNavigate: (section: NavigationSection, itemId?: string) => void;
}

// Utility function to convert UUID to readable words
const uuidToWords = (uuid: string): string => {
  // Remove hyphens and convert to uppercase
  const cleanUuid = uuid.replace(/-/g, '').toUpperCase();
  
  // Create a mapping of hex characters to words
  const hexToWords: { [key: string]: string } = {
    '0': 'Zero', '1': 'One', '2': 'Two', '3': 'Three', '4': 'Four',
    '5': 'Five', '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine',
    'A': 'Alpha', 'B': 'Beta', 'C': 'Charlie', 'D': 'Delta', 'E': 'Echo',
    'F': 'Foxtrot'
  };
  
  // Take first 8 characters and convert to words
  const firstEight = cleanUuid.substring(0, 8);
  const words = firstEight.split('').map(char => hexToWords[char] || char).join('');
  
  // Return first 12 characters of the word representation
  return words.substring(0, 12);
};

export default function UserManagement({ onNavigate }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [userSessions, setUserSessions] = useState<UserSession[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [emailConfig, setEmailConfig] = useState<EmailConfig>({
    provider: 'sendgrid',
    from_email: 'noreply@riofish.com',
    from_name: 'RioFish System',
    api_key: ''
  });
  
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('users');
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isEmailConfigOpen, setIsEmailConfigOpen] = useState(false);
  const [isFarmerDialogOpen, setIsFarmerDialogOpen] = useState(false);
  const [showStorageDialog, setShowStorageDialog] = useState(false);
  const [isStorageDialogOpen, setIsStorageDialogOpen] = useState(false);
  const [isOutletDialogOpen, setIsOutletDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
  const [selectedOutlet, setSelectedOutlet] = useState<Outlet | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [roleFormErrors, setRoleFormErrors] = useState<{[key: string]: string}>({});
  const [emailValidation, setEmailValidation] = useState<{isValid: boolean; message: string}>({isValid: true, message: ''});
  const [passwordValidation, setPasswordValidation] = useState<{isValid: boolean; message: string}>({isValid: true, message: ''});
  const [phoneValidation, setPhoneValidation] = useState<{isValid: boolean; message: string}>({isValid: true, message: ''});
  
  const [userForm, setUserForm] = useState({
    email: '',
    first_name: '',
    last_name: '',
    role: '',
    phone: '',
    is_active: true,
    password: '',
    confirm_password: ''
  });

  const [roleForm, setRoleForm] = useState({
    name: '',
    display_name: '',
    description: '',
    permissions: [] as string[],
    icon: 'Shield',
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    is_active: true
  });

  // Email validation function
  const validateEmail = async (email: string) => {
    if (!email || email.length < 3) {
      setEmailValidation({isValid: true, message: ''});
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailValidation({isValid: false, message: 'Please enter a valid email address'});
      return;
    }

    try {
      let query = supabase
        .from('profiles')
        .select('id')
        .eq('email', email.toLowerCase().trim());
      
      // Only add the neq filter if we're editing an existing user
      if (selectedUser?.id) {
        query = query.neq('id', selectedUser.id);
      }
      
      const { data: existingEmail, error } = await query;

      if (error && error.code !== 'PGRST116') {
        setEmailValidation({isValid: true, message: ''});
        return;
      }

      if (existingEmail && existingEmail.length > 0) {
        setEmailValidation({isValid: false, message: 'This email is already in use'});
      } else {
        setEmailValidation({isValid: true, message: 'Email is available'});
      }
    } catch (error) {
      setEmailValidation({isValid: true, message: ''});
    }
  };

  // Password validation function
  const validatePassword = async (password: string) => {
    if (!password || password.length < 6) {
      setPasswordValidation({isValid: false, message: 'Password must be at least 6 characters long'});
      return;
    }

    try {
      const { data: existingPasswords, error } = await supabase
        .from('profiles')
        .select('password_hash')
        .not('password_hash', 'is', null);

      if (error) {
        setPasswordValidation({isValid: true, message: ''});
        return;
      }

      if (existingPasswords && existingPasswords.length > 0) {
        const bcrypt = await import('bcryptjs');
        for (const user of existingPasswords) {
          if (user.password_hash) {
            const isMatch = await bcrypt.compare(password, user.password_hash);
            if (isMatch) {
              setPasswordValidation({isValid: false, message: 'This password is already in use'});
              return;
            }
          }
        }
      }

      setPasswordValidation({isValid: true, message: 'Password is available'});
    } catch (error) {
      setPasswordValidation({isValid: true, message: ''});
    }
  };

  // Phone validation function
  const validatePhone = async (phone: string) => {
    if (!phone || phone.trim() === '') {
      setPhoneValidation({isValid: true, message: ''});
      return;
    }

    // Basic phone format validation
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    if (!phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''))) {
      setPhoneValidation({isValid: false, message: 'Please enter a valid phone number'});
      return;
    }

    try {
      let query = supabase
        .from('profiles')
        .select('id')
        .eq('phone', phone.trim());
      
      // Only add the neq filter if we're editing an existing user
      if (selectedUser?.id) {
        query = query.neq('id', selectedUser.id);
      }
      
      const { data: existingPhone, error } = await query;

      if (error && error.code !== 'PGRST116') {
        setPhoneValidation({isValid: true, message: ''});
        return;
      }

      if (existingPhone && existingPhone.length > 0) {
        setPhoneValidation({isValid: false, message: 'This phone number is already in use'});
      } else {
        setPhoneValidation({isValid: true, message: 'Phone number is available'});
      }
    } catch (error) {
      setPhoneValidation({isValid: true, message: ''});
    }
  };

  const [farmerForm, setFarmerForm] = useState({
    name: '',
    phone: '',
    location: '',
    rating: 0,
    reliability: 'fair',
    status: 'active'
  });

  const [storageForm, setStorageForm] = useState({
    name: '',
    description: '',
    capacity_kg: 1000,
    temperature_celsius: 4,
    humidity_percent: 85,
    location_type: 'cold_storage' as 'cold_storage' | 'freezer' | 'ambient' | 'processing_area',
    status: 'active' as 'active' | 'maintenance' | 'inactive'
  });

  const [outletForm, setOutletForm] = useState({
    name: '',
    location: '',
    phone: '',
    manager_name: '',
    status: 'active' as 'active' | 'inactive' | 'suspended'
  });

  // Fetch roles from database
  const fetchRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setRoles(data || []);
    } catch (error: any) {
      console.warn('Could not fetch roles:', error);
      setRoles([]);
    }
  };

  // Fetch audit logs with user information
  const fetchAuditLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) {
        console.warn('Could not fetch audit logs:', error);
        setAuditLogs([]);
      } else {
        // Fetch user information for each audit log
        const auditLogsWithUsers = await Promise.all(
          (data || []).map(async (log) => {
            if (log.user_id) {
              try {
                const { data: userData } = await supabase
                  .from('profiles')
                  .select('first_name, last_name, email')
                  .eq('id', log.user_id)
                  .single();
                
                return {
                  ...log,
                  user: userData
                };
              } catch (userError) {
                console.warn('Could not fetch user for audit log:', userError);
                return log;
              }
            }
            return log;
          })
        );
        
        setAuditLogs(auditLogsWithUsers);
      }
    } catch (error: any) {
      console.warn('Could not fetch audit logs:', error);
      setAuditLogs([]);
    }
  };

  // Generate user-friendly audit log message with more details
  const getAuditLogMessage = (log: AuditLog) => {
    const userName = log.user ? `${log.user.first_name} ${log.user.last_name}` : 'Unknown User';
    const action = log.action.toLowerCase();
    const table = log.table_name.toLowerCase().replace('_', ' ');
    
    // Parse old and new values for more context
    let oldValues: any = null;
    let newValues: any = null;
    try {
      oldValues = log.old_values ? JSON.parse(log.old_values) : null;
      newValues = log.new_values ? JSON.parse(log.new_values) : null;
    } catch (e) {
      // Ignore parsing errors
    }
    
    switch (action) {
      case 'insert':
        switch (table) {
          case 'profiles':
            return `${userName} created a new user account${newValues?.email ? ` (${newValues.email})` : ''}`;
          case 'farmers':
            return `${userName} added a new farmer${newValues?.name ? ` (${newValues.name})` : ''}`;
          case 'warehouse entries':
            const fishType = newValues?.fish_type || 'fish';
            const weight = newValues?.total_weight ? `${newValues.total_weight}kg` : '';
            const entryCode = newValues?.entry_code ? ` (${newValues.entry_code})` : '';
            return `${userName} recorded a new ${fishType} entry${weight ? ` (${weight})` : ''}${entryCode}`;
          case 'outlet receiving inventory':
            const receivingFishType = newValues?.fish_type || 'fish';
            const receivingWeight = newValues?.weight_received ? `${newValues.weight_received}kg` : '';
            const receivingEntryCode = newValues?.entry_code ? ` (${newValues.entry_code})` : '';
            return `${userName} received ${receivingFishType} at outlet${receivingWeight ? ` (${receivingWeight})` : ''}${receivingEntryCode}`;
          case 'outlet orders':
            return `${userName} created a new order`;
          default:
            return `${userName} created a new ${table} record`;
        }
      case 'update':
        switch (table) {
          case 'profiles':
            const emailChange = oldValues?.email !== newValues?.email ? ` (${oldValues?.email} → ${newValues?.email})` : '';
            const roleChange = oldValues?.role !== newValues?.role ? ` (${oldValues?.role} → ${newValues?.role})` : '';
            return `${userName} updated user information${emailChange || roleChange || ''}`;
          case 'farmers':
            const nameChange = oldValues?.name !== newValues?.name ? ` (${oldValues?.name} → ${newValues?.name})` : '';
            return `${userName} updated farmer details${nameChange || ''}`;
          case 'outlet orders':
            if (newValues?.status === 'confirmed') {
              return `${userName} confirmed order ${log.record_id?.substring(0, 8) || ''}`;
            } else if (newValues?.status === 'cancelled') {
              return `${userName} cancelled order ${log.record_id?.substring(0, 8) || ''}`;
            }
            return `${userName} updated order details`;
          default:
            return `${userName} updated ${table} information`;
        }
      case 'delete':
        switch (table) {
          case 'profiles':
            return `${userName} deleted user account${oldValues?.email ? ` (${oldValues.email})` : ''}`;
          case 'farmers':
            return `${userName} removed farmer${oldValues?.name ? ` (${oldValues.name})` : ''}`;
          default:
            return `${userName} deleted ${table} record`;
        }
      case 'login':
        return `${userName} logged into the system`;
      case 'logout':
        return `${userName} logged out of the system`;
      default:
        return `${userName} performed ${action} on ${table}`;
    }
  };

  // Get additional details for audit log
  const getAuditLogDetails = (log: AuditLog) => {
    const details: string[] = [];
    
    // Add IP address if available
    if (log.ip_address) {
      details.push(`IP: ${log.ip_address}`);
    }
    
    // Add record ID if available
    if (log.record_id) {
      details.push(`ID: ${log.record_id.substring(0, 8)}...`);
    }
    
    // Add specific details based on action and table
    try {
      const oldValues: any = log.old_values ? JSON.parse(log.old_values) : null;
      const newValues: any = log.new_values ? JSON.parse(log.new_values) : null;
      
      if (log.table_name === 'warehouse_entries' && newValues) {
        if (newValues.entry_code) details.push(`Entry Code: ${newValues.entry_code}`);
        if (newValues.fish_type) details.push(`Type: ${newValues.fish_type}`);
        if (newValues.condition) details.push(`Grade: ${newValues.condition}`);
        if (newValues.total_weight) details.push(`Weight: ${newValues.total_weight}kg`);
        if (newValues.total_pieces) details.push(`Pieces: ${newValues.total_pieces}`);
        if (newValues.price_per_kg) details.push(`Price: $${newValues.price_per_kg}/kg`);
        if (newValues.farmer_id) details.push(`Farmer ID: ${newValues.farmer_id}`);
      }
      
      if (log.table_name === 'outlet_receiving' && newValues) {
        if (newValues.actual_weight_received) details.push(`Weight Received: ${newValues.actual_weight_received}kg`);
        if (newValues.condition) details.push(`Condition: ${newValues.condition}`);
        if (newValues.outlet_name) details.push(`Outlet: ${newValues.outlet_name}`);
        if (newValues.received_date) details.push(`Date: ${newValues.received_date}`);
      }
      
      if (log.table_name === 'outlet_orders' && newValues) {
        if (newValues.order_number) details.push(`Order #: ${newValues.order_number}`);
        if (newValues.status) details.push(`Status: ${newValues.status}`);
        if (newValues.delivery_date) details.push(`Delivery: ${newValues.delivery_date}`);
      }
      
      if (log.table_name === 'profiles' && newValues) {
        if (newValues.role) details.push(`Role: ${newValues.role}`);
        if (newValues.is_active !== undefined) details.push(`Active: ${newValues.is_active ? 'Yes' : 'No'}`);
        if (newValues.phone) details.push(`Phone: ${newValues.phone}`);
      }
      
      if (log.table_name === 'farmers' && newValues) {
        if (newValues.location) details.push(`Location: ${newValues.location}`);
        if (newValues.phone) details.push(`Phone: ${newValues.phone}`);
        if (newValues.rating) details.push(`Rating: ${newValues.rating}/5`);
        if (newValues.reliability) details.push(`Reliability: ${newValues.reliability}`);
      }
      
    } catch (e) {
      // Ignore parsing errors
    }
    
    return details;
  };

  // Audit logging function - using centralized audit logger
  const logAuditEvent = async (action: string, tableName: string, recordId?: string, oldValues?: any, newValues?: any) => {
    try {
      await auditLog.custom(action, tableName, recordId, {
        old_values: oldValues,
        new_values: newValues
      });
    } catch (error) {
      console.warn('Failed to log audit event:', error);
    }
  };

  // Fetch email configuration - simplified
  const fetchEmailConfig = async () => {
    // For now, just use default email config since system_config table might not exist
    setEmailConfig({
      provider: 'sendgrid',
      from_email: 'noreply@riofish.com',
      from_name: 'Rio Fish Management',
      api_key: ''
    });
  };

  // Fetch storage locations
  const fetchStorageLocations = async () => {
    try {
      console.log('Fetching storage locations...');
      const { data, error } = await supabase
        .from('storage_locations')
        .select('*')
        .order('name');
      
      if (error) {
        console.error('Error fetching storage locations:', error);
        throw error;
      }
      
      console.log('Storage locations fetched successfully:', data);
      setStorageLocations(data || []);
    } catch (error: any) {
      console.error('Could not fetch storage locations:', error);
      setStorageLocations([]);
    }
  };

  // Fetch users
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.warn('Could not fetch users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch farmers
  const fetchFarmers = async () => {
    try {
      const { data, error } = await supabase
          .from('farmers')
          .select('*')
          .order('name');

      if (error) throw error;
      setFarmers(data || []);
    } catch (error: any) {
      console.warn('Could not fetch farmers:', error);
      setFarmers([]);
    }
  };

  // Fetch outlets
  const fetchOutlets = async () => {
    try {
      console.log('Fetching outlets...');
      const { data, error } = await supabase
          .from('outlets')
          .select('*')
          .order('name');

      if (error) {
        console.error('Error fetching outlets:', error);
        // If table doesn't exist, show a helpful message
        if (error.message.includes('relation "outlets" does not exist')) {
          console.warn('Outlets table does not exist. Please run the database setup script.');
          toast.error('Outlets table not found. Please contact administrator.');
        }
        throw error;
      }
      
      console.log('Outlets fetched successfully:', data?.length || 0, 'records');
      setOutlets(data || []);
    } catch (error: any) {
      console.warn('Could not fetch outlets:', error);
      setOutlets([]);
    }
  };

  useEffect(() => {
    fetchRoles();
    fetchUsers();
    fetchFarmers();
    fetchOutlets();
    fetchAuditLogs();
    fetchEmailConfig();
    fetchStorageLocations();
  }, []);

  // Validate role form
  const validateRoleForm = () => {
    const errors: {[key: string]: string} = {};

    // Validate role name
    if (!roleForm.name.trim()) {
      errors.name = 'Role name is required';
    } else if (roleForm.name.trim().length < 2) {
      errors.name = 'Role name must be at least 2 characters';
    } else if (roleForm.name.trim().length > 50) {
      errors.name = 'Role name must be less than 50 characters';
    } else if (!/^[a-zA-Z0-9_\s-]+$/.test(roleForm.name.trim())) {
      errors.name = 'Role name can only contain letters, numbers, spaces, hyphens, and underscores';
    }

    // Validate display name
    if (!roleForm.display_name.trim()) {
      errors.display_name = 'Display name is required';
    } else if (roleForm.display_name.trim().length < 2) {
      errors.display_name = 'Display name must be at least 2 characters';
    } else if (roleForm.display_name.trim().length > 100) {
      errors.display_name = 'Display name must be less than 100 characters';
    }

    // Validate description
    if (roleForm.description.trim().length > 500) {
      errors.description = 'Description must be less than 500 characters';
    }

    // Validate permissions
    if (!Array.isArray(roleForm.permissions) || roleForm.permissions.length === 0) {
      errors.permissions = 'At least one permission must be selected';
    } else if (roleForm.permissions.length > 50) {
      errors.permissions = 'Too many permissions selected (maximum 50)';
    }

    setRoleFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Create or update role
  const handleRoleSubmit = async () => {
    try {
      setProcessingAction('saving-role');

      // Validate form data
      if (!validateRoleForm()) {
        return;
      }

      // Normalize role name (lowercase, no spaces)
      const normalizedName = roleForm.name.toLowerCase().trim().replace(/\s+/g, '_');

      if (selectedRole) {
        // Update existing role - check if name conflicts with other roles
        if (normalizedName !== selectedRole.name) {
          const { data: existingRole, error: checkError } = await supabase
            .from('user_roles')
            .select('id')
            .eq('name', normalizedName)
            .neq('id', selectedRole.id)
            .single();

          if (checkError && checkError.code !== 'PGRST116') {
            throw checkError;
          }

          if (existingRole) {
            toast.error('Role name already exists', {
              description: 'Please choose a different name for the role'
            });
            return;
          }
        }

        // Remove duplicate permissions
        const uniquePermissions = [...new Set(roleForm.permissions)];

        // Update existing role
        const { error } = await supabase
          .from('user_roles')
          .update({
            ...roleForm,
            name: normalizedName,
            permissions: uniquePermissions
          })
          .eq('id', selectedRole.id);

        if (error) throw error;
        toast.success('Role updated successfully');
      } else {
        // Check if role name already exists for new role
        const { data: existingRole, error: checkError } = await supabase
          .from('user_roles')
          .select('id')
          .eq('name', normalizedName)
          .single();

        if (checkError && checkError.code !== 'PGRST116') {
          throw checkError;
        }

        if (existingRole) {
          toast.error('Role name already exists', {
            description: 'Please choose a different name for the role'
          });
          return;
        }

        // Remove duplicate permissions
        const uniquePermissions = [...new Set(roleForm.permissions)];

        // Create new role
        const { error } = await supabase
          .from('user_roles')
          .insert([{
            ...roleForm,
            name: normalizedName,
            permissions: uniquePermissions
          }]);

        if (error) {
          if (error.code === '23505') {
            toast.error('Role name already exists', {
              description: 'Please choose a different name for the role'
            });
            return;
          }
          throw error;
        }
        toast.success('Role created successfully');
      }

      setIsRoleDialogOpen(false);
      setSelectedRole(null);
      setRoleForm({
        name: '',
        display_name: '',
        description: '',
        permissions: [],
        icon: 'Shield',
        color: 'bg-gray-100 text-gray-800 border-gray-200',
        is_active: true
      });
      setRoleFormErrors({});
      fetchRoles();
    } catch (error: any) {
      toast.error(`Role operation failed: ${error.message}`);
    } finally {
      setProcessingAction(null);
    }
  };

  // Create or update user
  const handleUserSubmit = async () => {
    try {
      setProcessingAction('saving-user');

      // Basic validation
      if (!userForm.email || !userForm.first_name || !userForm.last_name) {
        toast.error('Please fill in all required fields');
        return;
      }

      // Check validation states
      if (!emailValidation.isValid) {
        toast.error('Please fix email validation errors');
        return;
      }

      if (!phoneValidation.isValid) {
        toast.error('Please fix phone number validation errors');
        return;
      }

      if (!selectedUser) {
        if (!userForm.password || userForm.password.length < 6) {
          toast.error('Password must be at least 6 characters long');
          return;
        }
        if (!passwordValidation.isValid) {
          toast.error('Please fix password validation errors');
          return;
        }
        if (userForm.password !== userForm.confirm_password) {
          toast.error('Passwords do not match');
          return;
        }
      }

      // Check for duplicate email (only for new users, not when editing)
      if (!selectedUser?.id) {
        const { data: existingEmail, error: emailCheckError } = await supabase
          .from('profiles')
          .select('id, email')
          .eq('email', userForm.email.toLowerCase().trim());

        if (emailCheckError && emailCheckError.code !== 'PGRST116') {
          throw emailCheckError;
        }

        if (existingEmail && existingEmail.length > 0) {
          toast.error('Email already exists', {
            description: 'Please choose a different email address'
          });
          return;
        }
      }

      // Check for duplicate phone number (only for new users, not when editing)
      if (!selectedUser?.id && userForm.phone && userForm.phone.trim() !== '') {
        const { data: existingPhone, error: phoneCheckError } = await supabase
          .from('profiles')
          .select('id, phone')
          .eq('phone', userForm.phone.trim());

        if (phoneCheckError && phoneCheckError.code !== 'PGRST116') {
          throw phoneCheckError;
        }

        if (existingPhone && existingPhone.length > 0) {
          toast.error('Phone number already exists', {
            description: 'Please choose a different phone number'
          });
          return;
        }
      }

      // Check for duplicate password (only for new users)
      if (!selectedUser) {
        const { data: existingPassword, error: passwordCheckError } = await supabase
          .from('profiles')
          .select('id, password_hash')
          .not('password_hash', 'is', null);

        if (passwordCheckError) {
          throw passwordCheckError;
        }

        // Check if any existing password matches the new one
        if (existingPassword && existingPassword.length > 0) {
          const bcrypt = await import('bcryptjs');
          for (const user of existingPassword) {
            if (user.password_hash) {
              const isMatch = await bcrypt.compare(userForm.password, user.password_hash);
              if (isMatch) {
                toast.error('Password already in use', {
                  description: 'Please choose a different password for security reasons'
                });
                return;
              }
            }
          }
        }
      }

      if (selectedUser) {
        // Update existing user
        const oldValues = {
          email: selectedUser.email,
          first_name: selectedUser.first_name,
          last_name: selectedUser.last_name,
          role: selectedUser.role,
          phone: selectedUser.phone,
          is_active: selectedUser.is_active
        };

        const newValues = {
          email: userForm.email,
          first_name: userForm.first_name,
          last_name: userForm.last_name,
          role: userForm.role,
          phone: userForm.phone,
          is_active: userForm.is_active
        };

        const { error } = await supabase
          .from('profiles')
          .update(newValues)
          .eq('id', selectedUser.id);

        if (error) throw error;

        // Log audit event
        await logAuditEvent('UPDATE', 'profiles', selectedUser.id, oldValues, newValues);
        
        toast.success('User updated successfully');
      } else {
        // Create new user profile with properly hashed password
        const bcrypt = await import('bcryptjs');
        const hashedPassword = await bcrypt.hash(userForm.password, 10);
        
        const newUserData = {
          email: userForm.email.toLowerCase().trim(),
          password_hash: hashedPassword,
          first_name: userForm.first_name.trim(),
          last_name: userForm.last_name.trim(),
          role: userForm.role,
          phone: userForm.phone?.trim() || null,
          is_active: userForm.is_active
        };

        const { data: newUser, error } = await supabase
          .from('profiles')
          .insert([newUserData])
          .select()
          .single();

        if (error) {
          if (error.code === '23505') {
            toast.error('Email already exists', {
              description: 'Please choose a different email address'
            });
            return;
          }
          throw error;
        }

        // Log audit event
        await logAuditEvent('INSERT', 'profiles', newUser.id, null, newUserData);
        
        toast.success('User created successfully');
      }

      setIsUserDialogOpen(false);
      setSelectedUser(null);
      setUserForm({
        email: '',
        first_name: '',
        last_name: '',
        role: '',
        phone: '',
        is_active: true,
        password: '',
        confirm_password: ''
      });
      setEmailValidation({isValid: true, message: ''});
      setPasswordValidation({isValid: true, message: ''});
      setPhoneValidation({isValid: true, message: ''});
      fetchUsers();
      fetchAuditLogs(); // Refresh audit logs
    } catch (error: any) {
      toast.error(`User operation failed: ${error.message}`);
    } finally {
      setProcessingAction(null);
    }
  };

  // Create or update farmer
  const handleFarmerSubmit = async () => {
    try {
      setProcessingAction('saving-farmer');
      
      // Validation
      if (!farmerForm.name || !farmerForm.phone || !farmerForm.location) {
        toast.error('Please fill in all required fields');
        return;
      }
      
      if (selectedFarmer) {
        // Update existing farmer
        const oldValues = {
          name: selectedFarmer.name,
          phone: selectedFarmer.phone,
          location: selectedFarmer.location,
          rating: selectedFarmer.rating,
          reliability: selectedFarmer.reliability,
          status: selectedFarmer.status
        };

        const { error } = await supabase
          .from('farmers')
          .update(farmerForm)
          .eq('id', selectedFarmer.id);

        if (error) throw error;

        // Log audit event
        await logAuditEvent('UPDATE', 'farmers', selectedFarmer.id, oldValues, farmerForm);
        
        toast.success('Farmer updated successfully');
      } else {
        // Create new farmer
        const { data: newFarmer, error } = await supabase
          .from('farmers')
          .insert([farmerForm])
          .select()
          .single();

        if (error) throw error;

        // Log audit event
        await logAuditEvent('INSERT', 'farmers', newFarmer.id, null, farmerForm);
        
        toast.success('Farmer created successfully');
      }

      setIsFarmerDialogOpen(false);
      setSelectedFarmer(null);
      setFarmerForm({
        name: '',
        phone: '',
        location: '',
        rating: 0,
        reliability: 'fair',
        status: 'active'
      });
      fetchFarmers();
      fetchAuditLogs(); // Refresh audit logs
    } catch (error: any) {
      toast.error(`Farmer operation failed: ${error.message}`);
    } finally {
      setProcessingAction(null);
    }
  };

  // Delete farmer
  const deleteFarmer = async (farmerId: string) => {
    if (!confirm('Are you sure you want to delete this farmer?')) return;
    
    try {
      setProcessingAction('deleting-farmer');
      
      // Get farmer data before deletion for audit log
      const farmer = farmers.find(f => f.id === farmerId);
      
      const { error } = await supabase
        .from('farmers')
        .delete()
        .eq('id', farmerId);

      if (error) throw error;

      // Log audit event
      if (farmer) {
        await logAuditEvent('DELETE', 'farmers', farmerId, farmer, null);
      }
      
      toast.success('Farmer deleted successfully');
      fetchFarmers();
      fetchAuditLogs(); // Refresh audit logs
    } catch (error: any) {
      toast.error(`Failed to delete farmer: ${error.message}`);
    } finally {
      setProcessingAction(null);
    }
  };

  // Create or update storage location
  const handleStorageSubmit = async () => {
    try {
      setProcessingAction('saving-storage');
      
      const { error } = await supabase
        .from('storage_locations')
        .insert([storageForm]);

      if (error) throw error;
      toast.success('Storage location created successfully');
      
      setIsStorageDialogOpen(false);
      setStorageForm({
        name: '',
        description: '',
        capacity_kg: 1000,
        temperature_celsius: 4,
        humidity_percent: 85,
        location_type: 'cold_storage',
        status: 'active'
      });
      fetchStorageLocations();
    } catch (error: any) {
      toast.error(`Storage location creation failed: ${error.message}`);
    } finally {
      setProcessingAction(null);
    }
  };

  // Toggle storage location status
  const toggleStorageStatus = async (storageId: string, currentStatus: string) => {
    try {
      setProcessingAction(`toggle-storage-${storageId}`);
      
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      
      const { error } = await supabase
        .from('storage_locations')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', storageId);

      if (error) throw error;
      
      toast.success(`Storage location marked as ${newStatus}`);
      fetchStorageLocations();
    } catch (error: any) {
      toast.error(`Failed to update storage status: ${error.message}`);
    } finally {
      setProcessingAction(null);
    }
  };

  // Create or update outlet
  const handleOutletSubmit = async () => {
    try {
      setProcessingAction('saving-outlet');

      // Prepare outlet data - only include fields that exist in the schema
      const outletData = {
        name: outletForm.name,
        location: outletForm.location,
        phone: outletForm.phone,
        manager_name: outletForm.manager_name || null,
        status: outletForm.status
      };

      console.log('Submitting outlet data:', outletData);

      if (selectedOutlet) {
        // Update existing outlet
        const { error } = await supabase
            .from('outlets')
            .update(outletData)
            .eq('id', selectedOutlet.id);

        if (error) {
          console.error('Update outlet error:', error);
          throw error;
        }
        toast.success('Outlet updated successfully');
      } else {
        // Create new outlet
        const { error } = await supabase
            .from('outlets')
            .insert([outletData]);

        if (error) {
          console.error('Create outlet error:', error);
          throw error;
        }
        toast.success('Outlet created successfully');
      }

      setIsOutletDialogOpen(false);
      setSelectedOutlet(null);
      setOutletForm({
        name: '',
        location: '',
        phone: '',
        manager_name: '',
        status: 'active'
      });
      fetchOutlets();
    } catch (error: any) {
      toast.error(`Outlet operation failed: ${error.message}`);
    } finally {
      setProcessingAction(null);
    }
  };

  // Delete outlet
  const deleteOutlet = async (outletId: string) => {
    if (!confirm('Are you sure you want to delete this outlet?')) return;
    
    try {
      setProcessingAction('deleting-outlet');
      const { error } = await supabase
        .from('outlets')
        .delete()
        .eq('id', outletId);

      if (error) throw error;
      toast.success('Outlet deleted successfully');
      fetchOutlets();
    } catch (error: any) {
      toast.error(`Failed to delete outlet: ${error.message}`);
    } finally {
      setProcessingAction(null);
    }
  };

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Get role icon component
  const getRoleIcon = (iconName: string) => {
    const icons: { [key: string]: any } = {
      Shield, Crown, Package, Building, Eye, Tractor, Warehouse
    };
    return icons[iconName] || Shield;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 content-container">
      <div className="space-y-8 responsive-padding max-w-7xl mx-auto">
        {/* Enhanced Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 p-8 text-white shadow-2xl">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative z-10">
      <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <Users className="h-8 w-8" />
                  </div>
        <div>
                    <h1 className="text-4xl font-bold tracking-tight">User Management</h1>
                    <p className="text-blue-100 text-lg">Comprehensive user, role, and system administration</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 mt-4">
                  <div className="flex items-center gap-2 text-blue-100">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium">System Active</span>
                  </div>
                  <div className="flex items-center gap-2 text-blue-100">
                    <Users className="h-4 w-4" />
                    <span className="text-sm">{users.length} Users</span>
                  </div>
                  <div className="flex items-center gap-2 text-blue-100">
                    <Tractor className="h-4 w-4" />
                    <span className="text-sm">{farmers.length} Farmers</span>
                  </div>
                </div>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            onClick={() => setIsEmailConfigOpen(true)}
                  variant="secondary"
                  className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm transition-all duration-200"
          >
                  <Settings className="h-4 w-4 mr-2" />
            Email Config
          </Button>
        </div>
            </div>
          </div>
          {/* Decorative elements */}
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
          <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
      </div>

        {/* Enhanced Main Content */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <TabsList className="flex w-full bg-gradient-to-r from-gray-50 to-gray-100 p-1 h-auto overflow-x-auto">
              <TabsTrigger 
                value="users" 
                className="flex items-center gap-3 px-6 py-4 font-medium data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-blue-600 transition-all duration-200 hover:bg-white/50 rounded-xl whitespace-nowrap"
              >
                <div className="p-2 rounded-lg bg-blue-100 data-[state=active]:bg-blue-600 transition-colors duration-200">
                  <Users className="h-5 w-5 data-[state=active]:text-white text-blue-600" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-semibold">Users</span>
                  <span className="text-xs text-gray-500">{users.length}</span>
                </div>
          </TabsTrigger>
              <TabsTrigger 
                value="farmers" 
                className="flex items-center gap-3 px-6 py-4 font-medium data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-green-600 transition-all duration-200 hover:bg-white/50 rounded-xl whitespace-nowrap"
              >
                <div className="p-2 rounded-lg bg-green-100 data-[state=active]:bg-green-600 transition-colors duration-200">
                  <Tractor className="h-5 w-5 data-[state=active]:text-white text-green-600" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-semibold">Farmers</span>
                  <span className="text-xs text-gray-500">{farmers.length}</span>
                </div>
          </TabsTrigger>
              <TabsTrigger 
                value="storage" 
                className="flex items-center gap-3 px-6 py-4 font-medium data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-purple-600 transition-all duration-200 hover:bg-white/50 rounded-xl whitespace-nowrap"
              >
                <div className="p-2 rounded-lg bg-purple-100 data-[state=active]:bg-purple-600 transition-colors duration-200">
                  <Warehouse className="h-5 w-5 data-[state=active]:text-white text-purple-600" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-semibold">Storage</span>
                  <span className="text-xs text-gray-500">{storageLocations.length}</span>
                </div>
          </TabsTrigger>
              <TabsTrigger 
                value="roles" 
                className="flex items-center gap-3 px-6 py-4 font-medium data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-orange-600 transition-all duration-200 hover:bg-white/50 rounded-xl whitespace-nowrap"
              >
                <div className="p-2 rounded-lg bg-orange-100 data-[state=active]:bg-orange-600 transition-colors duration-200">
                  <Shield className="h-5 w-5 data-[state=active]:text-white text-orange-600" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-semibold">Roles</span>
                  <span className="text-xs text-gray-500">{roles.length}</span>
                </div>
          </TabsTrigger>
              <TabsTrigger 
                value="frontend" 
                className="flex items-center gap-3 px-6 py-4 font-medium data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-indigo-600 transition-all duration-200 hover:bg-white/50 rounded-xl whitespace-nowrap"
              >
                <div className="p-2 rounded-lg bg-indigo-100 data-[state=active]:bg-indigo-600 transition-colors duration-200">
                  <Eye className="h-5 w-5 data-[state=active]:text-white text-indigo-600" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-semibold">Public View</span>
                  <span className="text-xs text-gray-500">Config</span>
                </div>
          </TabsTrigger>
              <TabsTrigger 
                value="audit" 
                className="flex items-center gap-3 px-6 py-4 font-medium data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-red-600 transition-all duration-200 hover:bg-white/50 rounded-xl whitespace-nowrap"
              >
                <div className="p-2 rounded-lg bg-red-100 data-[state=active]:bg-red-600 transition-colors duration-200">
                  <Activity className="h-5 w-5 data-[state=active]:text-white text-red-600" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-semibold">Audit Logs</span>
                  <span className="text-xs text-gray-500">{auditLogs.length}</span>
                </div>
          </TabsTrigger>
              <TabsTrigger 
                value="outlets" 
                className="flex items-center gap-3 px-6 py-4 font-medium data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-purple-600 transition-all duration-200 hover:bg-white/50 rounded-xl whitespace-nowrap"
              >
                <div className="p-2 rounded-lg bg-purple-100 data-[state=active]:bg-purple-600 transition-colors duration-200">
                  <Building2 className="h-5 w-5 data-[state=active]:text-white text-purple-600" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-semibold">Outlets</span>
                  <span className="text-xs text-gray-500">{outlets.length}</span>
                </div>
          </TabsTrigger>
        </TabsList>
          </div>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6">
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
              <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-100 rounded-xl">
                      <Users className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        User Management
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
                          {filteredUsers.length} Active
                        </Badge>
                </CardTitle>
                      <p className="text-gray-600 mt-1">Manage system users and their permissions</p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => {
                      setSelectedUser(null);
                      setUserForm({
                        email: '',
                        first_name: '',
                        last_name: '',
                        role: '',
                        phone: '',
                        is_active: true,
                        password: '',
                        confirm_password: ''
                      });
                      setEmailValidation({isValid: true, message: ''});
                      setPasswordValidation({isValid: true, message: ''});
                      setPhoneValidation({isValid: true, message: ''});
                      setIsUserDialogOpen(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                  <Plus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </div>
            </CardHeader>
              <CardContent className="p-6">
                {/* Enhanced Filters */}
                <div className="bg-gray-50 rounded-xl p-4 mb-6">
                  <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                          placeholder="Search users by name or email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10 bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500/20"
                    />
                  </div>
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                      <SelectTrigger className="w-full sm:w-[200px] bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500/20">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {roles
                      .filter((role) => role.name && role.name.trim() !== '')
                      .map((role) => (
                        <SelectItem key={role.id} value={role.name}>
                          {role.display_name || role.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                  </div>
              </div>

                {/* Enhanced Users Table */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="mobile-table-container">
                  <Table className="mobile-table">
                    <TableHeader className="bg-gradient-to-r from-gray-50 to-gray-100">
                      <TableRow className="border-b border-gray-200">
                        <TableHead className="font-semibold text-gray-700 py-4">User</TableHead>
                        <TableHead className="font-semibold text-gray-700 py-4">Contact</TableHead>
                        <TableHead className="font-semibold text-gray-700 py-4">Role</TableHead>
                        <TableHead className="font-semibold text-gray-700 py-4">Status</TableHead>
                        <TableHead className="font-semibold text-gray-700 py-4">Last Login</TableHead>
                        <TableHead className="font-semibold text-gray-700 py-4 text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user, index) => (
                        <TableRow 
                          key={user.id} 
                          className={`hover:bg-blue-50/50 transition-colors duration-200 border-b border-gray-100 ${
                            index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                          }`}
                        >
                          <TableCell className="py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                                {user.first_name.charAt(0)}{user.last_name.charAt(0)}
                              </div>
                              <div>
                                <div className="font-semibold text-gray-900">
                                  {user.first_name} {user.last_name}
                                </div>
                              </div>
                            </div>
                            </TableCell>
                          <TableCell className="py-4">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-gray-400" />
                              <span className="text-gray-700">{user.email}</span>
                            </div>
                            {user.phone && (
                              <div className="flex items-center gap-2 mt-1">
                                <Phone className="h-3 w-3 text-gray-400" />
                                <span className="text-sm text-gray-500">{user.phone}</span>
                              </div>
                            )}
                            </TableCell>
                          <TableCell className="py-4">
                            <Badge 
                              variant="outline" 
                              className="bg-blue-50 text-blue-700 border-blue-200 font-medium"
                            >
                              {user.role.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${user.is_active ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                              <Badge 
                                variant={user.is_active ? "default" : "secondary"}
                                className={user.is_active ? "bg-green-100 text-green-700 border-green-200" : ""}
                              >
                          {user.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                            </TableCell>
                          <TableCell className="py-4">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-gray-400" />
                              <span className="text-sm text-gray-600">
                        {user.last_login ? new Date(user.last_login).toLocaleDateString() : "Never"}
                              </span>
                            </div>
                            </TableCell>
                          <TableCell className="py-4">
                            <div className="flex justify-center gap-2">
                                <Button 
                                  size="sm" 
                            variant="outline"
                                className="hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all duration-200"
                            onClick={() => {
                              setSelectedUser(user);
                              setUserForm({
                                email: user.email,
                                first_name: user.first_name,
                                last_name: user.last_name,
                                role: user.role,
                                phone: user.phone || '',
                                is_active: user.is_active,
                                password: '',
                                confirm_password: ''
                              });
                              setEmailValidation({isValid: true, message: ''});
                              setPasswordValidation({isValid: true, message: ''});
                              setPhoneValidation({isValid: true, message: ''});
                              setIsUserDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                  ))}
                    </TableBody>
                  </Table>
                  </div>
                </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Farmers Tab */}
        <TabsContent value="farmers" className="space-y-6">
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100">
              <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-green-100 rounded-xl">
                      <Tractor className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        Farmer Management
                        <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                          {farmers.length} Registered
                        </Badge>
                </CardTitle>
                      <p className="text-gray-600 mt-1">Manage farmer profiles and relationships</p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => setIsFarmerDialogOpen(true)}
                    className="bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                  >
              <Plus className="h-4 w-4 mr-2" />
              Add Farmer
            </Button>
          </div>
            </CardHeader>
              <CardContent className="p-6">
                {/* Enhanced Farmers Table */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="mobile-table-container">
              <Table className="mobile-table">
                    <TableHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
                      <TableRow className="border-b border-green-100">
                        <TableHead className="font-semibold text-gray-700 py-4">Farmer</TableHead>
                        <TableHead className="font-semibold text-gray-700 py-4">Contact</TableHead>
                        <TableHead className="font-semibold text-gray-700 py-4">Location</TableHead>
                        <TableHead className="font-semibold text-gray-700 py-4">Rating</TableHead>
                        <TableHead className="font-semibold text-gray-700 py-4">Reliability</TableHead>
                        <TableHead className="font-semibold text-gray-700 py-4">Status</TableHead>
                        <TableHead className="font-semibold text-gray-700 py-4 text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                      {farmers.map((farmer, index) => (
                        <TableRow 
                          key={farmer.id}
                          className={`hover:bg-green-50/50 transition-colors duration-200 border-b border-gray-100 ${
                            index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                          }`}
                        >
                          <TableCell className="py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                                {farmer.name.charAt(0)}
                              </div>
                              <div>
                                <div className="font-semibold text-gray-900">{farmer.name}</div>
                              </div>
                            </div>
                        </TableCell>
                          <TableCell className="py-4">
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-gray-400" />
                              <span className="text-gray-700">{farmer.phone}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-gray-400" />
                              <span className="text-gray-700">{farmer.location}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="flex items-center gap-2">
                              <div className="flex">
                                {[...Array(5)].map((_, i) => (
                                  <div
                                    key={i}
                                    className={`w-4 h-4 ${
                                      i < farmer.rating ? 'text-yellow-400' : 'text-gray-300'
                                    }`}
                                  >
                                    ★
                                  </div>
                                ))}
                              </div>
                              <span className="text-sm text-gray-600 ml-1">({farmer.rating}/5)</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <Badge 
                              variant="outline" 
                              className={`font-medium ${
                                farmer.reliability === 'excellent' ? 'bg-green-100 text-green-700 border-green-200' :
                                farmer.reliability === 'good' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                farmer.reliability === 'fair' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                                'bg-red-100 text-red-700 border-red-200'
                              }`}
                            >
                              {farmer.reliability}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${farmer.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                              <Badge 
                                variant={farmer.status === 'active' ? "default" : "secondary"}
                                className={farmer.status === 'active' ? "bg-green-100 text-green-700 border-green-200" : ""}
                              >
                            {farmer.status}
                          </Badge>
                            </div>
                        </TableCell>
                          <TableCell className="py-4">
                            <div className="flex justify-center gap-2">
                            <Button
                              size="sm"
                            variant="outline"
                                className="hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-all duration-200"
                              onClick={() => {
                                setSelectedFarmer(farmer);
                                setFarmerForm({
                                  name: farmer.name,
                                  phone: farmer.phone,
                                  location: farmer.location,
                                  rating: farmer.rating,
                                  reliability: farmer.reliability,
                                status: farmer.status
                                });
                                setIsFarmerDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                            variant="outline"
                                className="hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-all duration-200"
                            onClick={() => deleteFarmer(farmer.id)}
                            disabled={processingAction === 'deleting-farmer'}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
                </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Storage Tab */}
        <TabsContent value="storage" className="space-y-6">
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-violet-50 border-b border-purple-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-100 rounded-xl">
                    <Warehouse className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                      Storage Management
                      <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">
                        {storageLocations.length} Locations
                      </Badge>
                    </CardTitle>
                    <p className="text-gray-600 mt-1">Monitor storage capacity and conditions</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={fetchStorageLocations}
                    variant="outline"
                    className="border-purple-200 text-purple-700 hover:bg-purple-50"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                  <Button 
                    onClick={() => setIsStorageDialogOpen(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Location
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {storageLocations.map((location) => (
                  <Card key={location.id} className="hover:shadow-lg transition-all duration-200 border border-gray-200 bg-white">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-semibold text-gray-900">{location.name}</CardTitle>
                        <Badge 
                          variant={location.status === 'active' ? 'default' : 'secondary'}
                          className={location.status === 'active' ? 'bg-green-100 text-green-700 border-green-200' : ''}
                        >
                          {location.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Type:</span>
                          <span className="font-medium capitalize">{location.location_type.replace('_', ' ')}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Capacity:</span>
                          <span className="font-medium">{location.current_usage_kg}/{location.capacity_kg} kg</span>
                        </div>
                        {location.temperature_celsius && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Temperature:</span>
                            <span className="font-medium">{location.temperature_celsius}°C</span>
                          </div>
                        )}
                        {location.humidity_percent && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Humidity:</span>
                            <span className="font-medium">{location.humidity_percent}%</span>
                          </div>
                        )}
                        <div className="text-xs text-gray-500 text-center">
                          {Math.round((location.current_usage_kg / location.capacity_kg) * 100)}% occupied
                        </div>
                        <div className="pt-2 border-t border-gray-100">
                          <Button
                            size="sm"
                            variant={location.status === 'active' ? 'destructive' : 'default'}
                            className={`w-full text-xs ${
                              location.status === 'active' 
                                ? 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200' 
                                : 'bg-green-100 text-green-700 hover:bg-green-200 border-green-200'
                            }`}
                            onClick={() => toggleStorageStatus(location.id, location.status)}
                            disabled={processingAction === `toggle-storage-${location.id}`}
                          >
                            {processingAction === `toggle-storage-${location.id}` ? (
                              'Updating...'
                            ) : location.status === 'active' ? (
                              'Mark Inactive'
                            ) : (
                              'Mark Active'
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Roles Tab */}
        <TabsContent value="roles" className="space-y-6">
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
                  <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-orange-100 rounded-xl">
                      <Shield className="h-6 w-6 text-orange-600" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        Role Management
                        <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200">
                          {roles.length} Roles
                        </Badge>
                    </CardTitle>
                      <p className="text-gray-600 mt-1">Define user roles and permissions</p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => setIsRoleDialogOpen(true)}
                    className="bg-orange-600 hover:bg-orange-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                  <Plus className="h-4 w-4 mr-2" />
              Add Role
            </Button>
          </div>
            </CardHeader>
              <CardContent className="p-6">
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {roles.map((role) => {
                  const IconComponent = getRoleIcon(role.icon);
              return (
                      <Card key={role.id} className="hover:shadow-lg transition-all duration-200 border border-gray-200 bg-white">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                            <Badge className={`${role.color} px-3 py-1 font-medium`}>
                        <IconComponent className="w-4 h-4 mr-2" />
                        {role.display_name}
                      </Badge>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                              variant="outline"
                                className="hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700 transition-all duration-200"
                              onClick={() => {
                                setSelectedRole(role);
                                setRoleForm({
                                  name: role.name,
                                  display_name: role.display_name,
                                  description: role.description,
                                  permissions: Array.isArray(role.permissions) ? role.permissions : 
                                             (typeof role.permissions === 'string' ? JSON.parse(role.permissions) : []),
                                  icon: role.icon,
                                  color: role.color,
                                  is_active: role.is_active
                                });
                                setIsRoleDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                        <p className="text-sm text-gray-600 mb-3">{role.description}</p>
                          <div className="space-y-2">
                          <p className="text-xs font-medium text-gray-500">Permissions:</p>
                          <div className="flex flex-wrap gap-1">
                            {Array.isArray(role.permissions) && role.permissions.slice(0, 3).map((permission, index) => (
                                <Badge key={index} variant="secondary" className="text-xs bg-gray-100 text-gray-700">
                                {permission}
                        </Badge>
                            ))}
                            {Array.isArray(role.permissions) && role.permissions.length > 3 && (
                                <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-700">
                                +{role.permissions.length - 3} more
                              </Badge>
                            )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
            </CardContent>
          </Card>

          {/* Current User Permissions - Only show when a role is selected */}
          {selectedRole && (
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-100 rounded-xl">
                    <Shield className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-bold text-gray-900">
                      Permissions for: {selectedRole.display_name}
                    </CardTitle>
                    <p className="text-gray-600 mt-1">View permissions assigned to this role</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <UserPermissionsView className="border-0 shadow-none bg-transparent" />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Frontend Tab */}
        <TabsContent value="frontend" className="space-y-6">
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-indigo-100">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-100 rounded-xl">
                    <Eye className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-bold text-gray-900">Public View Configuration</CardTitle>
                    <p className="text-gray-600 mt-1">Configure public-facing settings and appearance</p>
                  </div>
                </div>
            </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  <Alert className="border-indigo-200 bg-indigo-50">
                    <Info className="h-4 w-4 text-indigo-600" />
                    <AlertDescription className="text-indigo-800">
                    Configure public-facing settings and frontend appearance.
            </AlertDescription>
          </Alert>
                  <div className="grid gap-6">
                  <div>
                      <Label htmlFor="site_name" className="text-sm font-medium text-gray-700">Site Name</Label>
                      <Input 
                        id="site_name" 
                        placeholder="Rio Fish Management" 
                        className="mt-1 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500/20"
                      />
                  </div>
                  <div>
                      <Label htmlFor="site_description" className="text-sm font-medium text-gray-700">Site Description</Label>
                      <Textarea 
                        id="site_description" 
                        placeholder="Professional fish management system" 
                        className="mt-1 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500/20"
                      />
                  </div>
                  <div>
                      <Label htmlFor="contact_email" className="text-sm font-medium text-gray-700">Contact Email</Label>
                      <Input 
                        id="contact_email" 
                        type="email" 
                        placeholder="contact@riofish.com" 
                        className="mt-1 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500/20"
                      />
                  </div>
                </div>
                  <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200">
                    Save Configuration
                  </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Logs Tab */}
        <TabsContent value="audit" className="space-y-6">
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-red-50 to-pink-50 border-b border-red-100">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-red-100 rounded-xl">
                    <Activity className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                      Audit Logs
                      <Badge variant="secondary" className="bg-red-100 text-red-700 border-red-200">
                        {auditLogs.length} Entries
                      </Badge>
              </CardTitle>
                    <p className="text-gray-600 mt-1">Monitor system activity and user actions</p>
                  </div>
                </div>
            </CardHeader>
              <CardContent className="p-6">
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="mobile-table-container">
                  <Table className="mobile-table">
                    <TableHeader className="bg-gradient-to-r from-red-50 to-pink-50">
                      <TableRow className="border-b border-red-100">
                        <TableHead className="font-semibold text-gray-700 py-4">Activity</TableHead>
                        <TableHead className="font-semibold text-gray-700 py-4">User</TableHead>
                        <TableHead className="font-semibold text-gray-700 py-4">Details</TableHead>
                        <TableHead className="font-semibold text-gray-700 py-4">Date & Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log, index) => (
                        <TableRow 
                          key={log.id}
                          className={`hover:bg-red-50/50 transition-colors duration-200 border-b border-gray-100 ${
                            index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                          }`}
                        >
                          <TableCell className="py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                                <Activity className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="text-gray-900 font-medium">
                                  {getAuditLogMessage(log)}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {log.table_name} • {log.action}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center text-white font-semibold text-xs">
                                {log.user ? log.user.first_name.charAt(0) : 'U'}
                              </div>
                              <div>
                                <p className="text-gray-900 font-medium">
                                  {log.user ? `${log.user.first_name} ${log.user.last_name}` : 'Unknown User'}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {log.user?.email || 'No email'}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="space-y-1">
                              {getAuditLogDetails(log).map((detail, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                                  <span className="text-sm text-gray-600">{detail}</span>
                                </div>
                              ))}
                              {getAuditLogDetails(log).length === 0 && (
                                <span className="text-sm text-gray-400 italic">No additional details</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="text-right">
                              <p className="text-gray-900 font-medium">
                                {new Date(log.created_at).toLocaleDateString()}
                              </p>
                              <p className="text-sm text-gray-500">
                                {new Date(log.created_at).toLocaleTimeString()}
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Outlets Tab */}
        <TabsContent value="outlets" className="space-y-6">
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-100 rounded-xl">
                    <Building2 className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                      Outlet Management
                      <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">
                        {outlets.length} Outlets
                      </Badge>
                    </CardTitle>
                    <p className="text-gray-600 mt-1">Manage retail outlets and distribution partners</p>
                  </div>
                </div>
                <Button 
                  onClick={() => setIsOutletDialogOpen(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Outlet
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <Table>
                  <TableHeader className="bg-gradient-to-r from-purple-50 to-indigo-50">
                    <TableRow className="border-b border-purple-100">
                      <TableHead className="font-semibold text-gray-700 py-4">Outlet Name</TableHead>
                      <TableHead className="font-semibold text-gray-700 py-4">Location</TableHead>
                      <TableHead className="font-semibold text-gray-700 py-4">Contact</TableHead>
                      <TableHead className="font-semibold text-gray-700 py-4">Status</TableHead>
                      <TableHead className="font-semibold text-gray-700 py-4">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outlets.map((outlet, index) => (
                      <TableRow 
                        key={outlet.id}
                        className={`hover:bg-purple-50/50 transition-colors duration-200 border-b border-gray-100 ${
                          index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                        }`}
                      >
                        <TableCell className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold">
                              {outlet.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">{outlet.name}</div>
                              {outlet.manager_name && (
                                <div className="text-sm text-gray-500">{outlet.manager_name}</div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-700">{outlet.location}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-700">{outlet.phone}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <Badge 
                            className={`${
                              outlet.status === 'active' 
                                ? 'bg-green-100 text-green-800 border-green-200' 
                                : outlet.status === 'inactive'
                                ? 'bg-gray-100 text-gray-800 border-gray-200'
                                : 'bg-red-100 text-red-800 border-red-200'
                            }`}
                          >
                            {outlet.status.charAt(0).toUpperCase() + outlet.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedOutlet(outlet);
                                setOutletForm({
                                  name: outlet.name,
                                  location: outlet.location,
                                  phone: outlet.phone,
                                  manager_name: outlet.manager_name || '',
                                  status: outlet.status
                                });
                                setIsOutletDialogOpen(true);
                              }}
                              className="border-blue-200 text-blue-700 hover:bg-blue-50"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => deleteOutlet(outlet.id)}
                              className="border-red-200 text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
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
            <DialogDescription className="text-gray-600">
              {selectedUser ? 'Update user information' : 'Create a new user account with a secure password'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={(e) => { e.preventDefault(); handleUserSubmit(); }} className="space-y-6">
            {!selectedUser && (
              <Alert className="border-blue-200 bg-blue-50">
                <Lock className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  Password must be at least 6 characters long. The user will use this password to log in.
                </AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-4">
              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name" className="text-sm font-medium text-gray-700">
                    First Name *
                  </Label>
                <Input
                  id="first_name"
                  value={userForm.first_name}
                  onChange={(e) => setUserForm({...userForm, first_name: e.target.value})}
                  required
                    className="w-full"
                    placeholder="Enter first name"
                />
              </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name" className="text-sm font-medium text-gray-700">
                    Last Name *
                  </Label>
                <Input
                  id="last_name"
                  value={userForm.last_name}
                  onChange={(e) => setUserForm({...userForm, last_name: e.target.value})}
                  required
                    className="w-full"
                    placeholder="Enter last name"
                />
              </div>
            </div>

              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                  Email Address *
                </Label>
              <Input
                id="email"
                type="email"
                value={userForm.email}
                  onChange={(e) => {
                    setUserForm({...userForm, email: e.target.value});
                    validateEmail(e.target.value);
                  }}
                required
                  className={`w-full ${!emailValidation.isValid ? 'border-red-300 focus:border-red-500' : emailValidation.message === 'Email is available' ? 'border-green-300 focus:border-green-500' : ''}`}
                  placeholder="user@example.com"
              />
                {emailValidation.message && (
                  <p className={`text-xs ${emailValidation.isValid ? 'text-green-600' : 'text-red-600'}`}>
                    {emailValidation.message}
                  </p>
                )}
            </div>

              {/* Role Field */}
              <div className="space-y-2">
                <Label htmlFor="role" className="text-sm font-medium text-gray-700">
                  Role *
                </Label>
                <Select value={userForm.role} onValueChange={(value) => setUserForm({...userForm, role: value})}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                    {roles
                      .filter((role) => role.name && role.name.trim() !== '')
                      .map((role) => (
                        <SelectItem key={role.id} value={role.name}>
                          {role.display_name || role.name}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>

              {/* Phone Field */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium text-gray-700">
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  value={userForm.phone}
                  onChange={(e) => {
                    setUserForm({...userForm, phone: e.target.value});
                    validatePhone(e.target.value);
                  }}
                  className={`w-full ${!phoneValidation.isValid ? 'border-red-300 focus:border-red-500' : phoneValidation.message === 'Phone number is available' ? 'border-green-300 focus:border-green-500' : ''}`}
                  placeholder="+254 700 000 000"
                />
                {phoneValidation.message && (
                  <p className={`text-xs ${phoneValidation.isValid ? 'text-green-600' : 'text-red-600'}`}>
                    {phoneValidation.message}
                  </p>
                )}
              </div>

              {/* Password Fields - Only for new users */}
              {!selectedUser && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                      Password *
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      value={userForm.password}
                      onChange={(e) => {
                        setUserForm({...userForm, password: e.target.value});
                        validatePassword(e.target.value);
                      }}
                      required
                      className={`w-full ${!passwordValidation.isValid ? 'border-red-300 focus:border-red-500' : passwordValidation.message === 'Password is available' ? 'border-green-300 focus:border-green-500' : ''}`}
                      placeholder="Enter a secure password"
                    />
                    {passwordValidation.message && (
                      <p className={`text-xs ${passwordValidation.isValid ? 'text-green-600' : 'text-red-600'}`}>
                        {passwordValidation.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm_password" className="text-sm font-medium text-gray-700">
                      Confirm Password *
                    </Label>
                    <Input
                      id="confirm_password"
                      type="password"
                      value={userForm.confirm_password}
                      onChange={(e) => setUserForm({...userForm, confirm_password: e.target.value})}
                      required
                      className={`w-full ${userForm.confirm_password && userForm.password !== userForm.confirm_password ? 'border-red-300 focus:border-red-500' : userForm.confirm_password && userForm.password === userForm.confirm_password ? 'border-green-300 focus:border-green-500' : ''}`}
                      placeholder="Confirm the password"
                    />
                    {userForm.confirm_password && (
                      <p className={`text-xs ${userForm.password === userForm.confirm_password ? 'text-green-600' : 'text-red-600'}`}>
                        {userForm.password === userForm.confirm_password ? 'Passwords match' : 'Passwords do not match'}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Active Status */}
              <div className="flex items-center space-x-3 pt-2">
              <input
                type="checkbox"
                id="is_active"
                checked={userForm.is_active}
                onChange={(e) => setUserForm({...userForm, is_active: e.target.checked})}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
                <Label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                  User is active
                </Label>
            </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsUserDialogOpen(false)}
                className="px-6"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={processingAction === 'saving-user'}
                className="px-6 bg-blue-600 hover:bg-blue-700"
              >
                {processingAction === 'saving-user' ? 'Saving...' : (selectedUser ? 'Update User' : 'Create User')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Role Dialog */}
      <Dialog open={isRoleDialogOpen} onOpenChange={(open) => {
        setIsRoleDialogOpen(open);
        if (!open) {
          setRoleFormErrors({});
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-6 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-sm">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold text-gray-900">
                  {selectedRole ? 'Edit Role' : 'Create New Role'}
                </DialogTitle>
                <DialogDescription className="text-gray-600 mt-1">
                  {selectedRole ? 'Update role information and permissions' : 'Define a new role with specific permissions and access levels'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <form onSubmit={(e) => { e.preventDefault(); handleRoleSubmit(); }} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-2 space-y-8">
            {/* Basic Information */}
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="name" className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    Role Name *
                  </Label>
                  <Input
                    id="name"
                    value={roleForm.name}
                    onChange={(e) => {
                      setRoleForm({...roleForm, name: e.target.value});
                      if (roleFormErrors.name) {
                        setRoleFormErrors({...roleFormErrors, name: ''});
                      }
                    }}
                    className={`transition-all duration-200 ${roleFormErrors.name ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 bg-red-50' : 'border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 hover:border-gray-300'} ${selectedRole ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                    placeholder="e.g., warehouse_manager"
                    maxLength={50}
                    required
                    disabled={!!selectedRole}
                  />
                  {roleFormErrors.name && (
                    <p className="text-red-600 text-xs flex items-center gap-1.5 font-medium">
                      <AlertTriangle className="h-3 w-3" />
                      {roleFormErrors.name}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
                    {selectedRole ? 'Role name cannot be changed after creation' : 'Internal identifier (lowercase, no spaces)'}
                  </p>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="display_name" className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    Display Name *
                  </Label>
                  <Input
                    id="display_name"
                    value={roleForm.display_name}
                    onChange={(e) => {
                      setRoleForm({...roleForm, display_name: e.target.value});
                      if (roleFormErrors.display_name) {
                        setRoleFormErrors({...roleFormErrors, display_name: ''});
                      }
                    }}
                    className={`transition-all duration-200 ${roleFormErrors.display_name ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 bg-red-50' : 'border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 hover:border-gray-300'} ${selectedRole ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                    placeholder="e.g., Warehouse Manager"
                    maxLength={100}
                    required
                    disabled={!!selectedRole}
                  />
                  {roleFormErrors.display_name && (
                    <p className="text-red-600 text-xs flex items-center gap-1.5 font-medium">
                      <AlertTriangle className="h-3 w-3" />
                      {roleFormErrors.display_name}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
                    {selectedRole ? 'Display name cannot be changed after creation' : 'User-friendly name shown in the interface'}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="description" className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  Description
                </Label>
                <Textarea
                  id="description"
                  value={roleForm.description}
                  onChange={(e) => {
                    setRoleForm({...roleForm, description: e.target.value});
                    if (roleFormErrors.description) {
                      setRoleFormErrors({...roleFormErrors, description: ''});
                    }
                  }}
                  className={`transition-all duration-200 resize-none ${roleFormErrors.description ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 bg-red-50' : 'border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 hover:border-gray-300'}`}
                  placeholder="Describe the role's responsibilities and scope..."
                  maxLength={500}
                  rows={3}
                />
                {roleFormErrors.description && (
                  <p className="text-red-600 text-xs flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="h-3 w-3" />
                    {roleFormErrors.description}
                  </p>
                )}
                <div className="flex justify-between items-center">
                  <p className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
                    Optional description of the role's purpose
                  </p>
                  <span className={`text-xs px-2 py-1 rounded ${roleForm.description.length > 450 ? 'text-orange-600 bg-orange-50' : 'text-gray-500 bg-gray-50'}`}>
                    {roleForm.description.length}/500
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-4 p-5 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200 hover:shadow-sm transition-all duration-200">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={roleForm.is_active}
                  onChange={(e) => setRoleForm({...roleForm, is_active: e.target.checked})}
                  className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded transition-all duration-200"
                />
                <div className="flex-1">
                  <Label htmlFor="is_active" className="text-sm font-semibold text-gray-800 cursor-pointer">
                    Active Role
                  </Label>
                  <p className="text-xs text-gray-600 mt-1">
                    Inactive roles cannot be assigned to users
                  </p>
                </div>
                <div className={`p-2 rounded-full transition-all duration-200 ${roleForm.is_active ? 'bg-green-100 shadow-sm' : 'bg-gray-200'}`}>
                  {roleForm.is_active ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </div>
            </div>

            {/* Permissions - Only show when role is active */}
            {roleForm.is_active && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="permissions" className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    Select Permissions *
                  </Label>
                  <div className={`border-2 rounded-xl p-5 transition-all duration-200 ${roleFormErrors.permissions ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'}`}>
                    <div className="min-h-[60px] flex items-center">
                      <PermissionsDropdown
                        selectedPermissions={roleForm.permissions}
                        onPermissionsChange={(permissions) => {
                          setRoleForm({...roleForm, permissions});
                          if (roleFormErrors.permissions) {
                            setRoleFormErrors({...roleFormErrors, permissions: ''});
                          }
                        }}
                        className="w-full"
                      />
                    </div>
                  </div>
                  {roleFormErrors.permissions ? (
                    <p className="text-red-600 text-xs flex items-center gap-1.5 font-medium">
                      <AlertTriangle className="h-3 w-3" />
                      {roleFormErrors.permissions}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
                      Choose the specific permissions this role should have. Use "All Permissions" for full admin access.
                    </p>
                  )}
                </div>

                {/* Permission Summary */}
                {Array.isArray(roleForm.permissions) && roleForm.permissions.length > 0 && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-1.5 bg-blue-100 rounded-lg">
                        <Shield className="h-4 w-4 text-blue-600" />
                      </div>
                      <span className="text-sm font-semibold text-blue-900">
                        Selected Permissions ({(Array.isArray(roleForm.permissions) ? roleForm.permissions : []).length})
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(Array.isArray(roleForm.permissions) ? roleForm.permissions : []).slice(0, 8).map((permission) => (
                        <Badge key={permission} variant="secondary" className="text-xs bg-blue-100 text-blue-800 border border-blue-200 hover:bg-blue-200 transition-colors duration-200">
                          {permission}
                        </Badge>
                      ))}
                      {(Array.isArray(roleForm.permissions) ? roleForm.permissions : []).length > 8 && (
                        <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 border border-blue-200">
                          +{(Array.isArray(roleForm.permissions) ? roleForm.permissions : []).length - 8} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Inactive Role Message */}
            {!roleForm.is_active && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <XCircle className="h-6 w-6 text-gray-400" />
                  <span className="text-sm font-medium text-gray-600">Role is Inactive</span>
                </div>
                <p className="text-xs text-gray-500">
                  Permissions are not available for inactive roles. Enable the role to configure permissions.
                </p>
              </div>
            )}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-200 flex-shrink-0">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setIsRoleDialogOpen(false);
                  setRoleFormErrors({});
                }}
                className="px-6 hover:bg-gray-50 transition-colors duration-200"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={processingAction === 'saving-role'}
                className="px-6 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processingAction === 'saving-role' ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-2" />
                    {selectedRole ? 'Update Role' : 'Create Role'}
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Farmer Dialog */}
      <Dialog open={isFarmerDialogOpen} onOpenChange={setIsFarmerDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedFarmer ? 'Edit Farmer' : 'Add New Farmer'}
            </DialogTitle>
            <DialogDescription>
              {selectedFarmer ? 'Update farmer information' : 'Add a new farmer to the system'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleFarmerSubmit(); }}>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={farmerForm.name}
                  onChange={(e) => setFarmerForm({...farmerForm, name: e.target.value})}
                  required
                />
                        </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={farmerForm.phone}
                  onChange={(e) => setFarmerForm({...farmerForm, phone: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label htmlFor="location">Location</Label>
              <Input
                  id="location"
                value={farmerForm.location}
                onChange={(e) => setFarmerForm({...farmerForm, location: e.target.value})}
                required
              />
            </div>
              <div className="grid grid-cols-2 gap-4">
              <div>
                  <Label htmlFor="rating">Rating (0-5)</Label>
                <Input
                    id="rating"
                  type="number"
                  min="0"
                  max="5"
                  value={farmerForm.rating}
                    onChange={(e) => setFarmerForm({...farmerForm, rating: parseInt(e.target.value) || 0})}
                />
              </div>
              <div>
                  <Label htmlFor="reliability">Reliability</Label>
                  <Select value={farmerForm.reliability} onValueChange={(value) => setFarmerForm({...farmerForm, reliability: value})}>
                    <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excellent">Excellent</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                    <SelectItem value="poor">Poor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
                  </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsFarmerDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={processingAction === 'saving-farmer'}>
                {processingAction === 'saving-farmer' ? 'Saving...' : (selectedFarmer ? 'Update' : 'Create')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Email Configuration Dialog */}
      <Dialog open={isEmailConfigOpen} onOpenChange={setIsEmailConfigOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" />
              Email Configuration
            </DialogTitle>
            <DialogDescription>
              Configure email settings for notifications and communications
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); }}>
            <div className="grid gap-4 py-4">
            <div>
                <Label htmlFor="provider" className="text-sm font-medium text-gray-700">Email Provider</Label>
                <Select value={emailConfig.provider} onValueChange={(value: any) => setEmailConfig({...emailConfig, provider: value})}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sendgrid">SendGrid</SelectItem>
                  <SelectItem value="ses">AWS SES</SelectItem>
                  <SelectItem value="smtp">SMTP</SelectItem>
                    <SelectItem value="resend">Resend</SelectItem>
                </SelectContent>
              </Select>
            </div>

              <div className="grid grid-cols-2 gap-4">
              <div>
                  <Label htmlFor="from_email" className="text-sm font-medium text-gray-700">From Email</Label>
                <Input
                  id="from_email"
                  type="email"
                  value={emailConfig.from_email}
                  onChange={(e) => setEmailConfig({...emailConfig, from_email: e.target.value})}
                  className="mt-1"
                  placeholder="noreply@riofish.com"
                  required
                />
              </div>
              <div>
                  <Label htmlFor="from_name" className="text-sm font-medium text-gray-700">From Name</Label>
                <Input
                  id="from_name"
                  value={emailConfig.from_name}
                  onChange={(e) => setEmailConfig({...emailConfig, from_name: e.target.value})}
                  className="mt-1"
                    placeholder="Rio Fish Management"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="api_key" className="text-sm font-medium text-gray-700">API Key *</Label>
              <Input
                id="api_key"
                name="api_key"
                type="password"
                  autoComplete="off"
                value={emailConfig.api_key}
                onChange={(e) => setEmailConfig({...emailConfig, api_key: e.target.value})}
                className="mt-1"
                disabled={processingAction === 'saving-email-config'}
                placeholder="Your email service API key"
                required
              />
            </div>

            {emailConfig.provider === 'smtp' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="smtp_host" className="text-sm font-medium text-gray-700">SMTP Host</Label>
                    <Input
                      id="smtp_host"
                      value={emailConfig.smtp_host || ''}
                      onChange={(e) => setEmailConfig({...emailConfig, smtp_host: e.target.value})}
                      className="mt-1"
                      placeholder="smtp.gmail.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="smtp_port" className="text-sm font-medium text-gray-700">SMTP Port</Label>
                    <Input
                      id="smtp_port"
                      type="number"
                      value={emailConfig.smtp_port || ''}
                      onChange={(e) => setEmailConfig({...emailConfig, smtp_port: parseInt(e.target.value) || 587})}
                      className="mt-1"
                      placeholder="587"
                    />
                  </div>
                  <div>
                    <Label htmlFor="smtp_username" className="text-sm font-medium text-gray-700">SMTP Username</Label>
                    <Input
                      id="smtp_username"
                      value={emailConfig.smtp_username || ''}
                      onChange={(e) => setEmailConfig({...emailConfig, smtp_username: e.target.value})}
                      className="mt-1"
                      placeholder="your-email@gmail.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="smtp_pass" className="text-sm font-medium text-gray-700">SMTP Password</Label>
                    <Input
                      id="smtp_pass"
                      name="smtp_pass"
                      type="password"
                      autoComplete="off"
                      value={emailConfig.smtp_pass || ''}
                      onChange={(e) => setEmailConfig({...emailConfig, smtp_pass: e.target.value})}
                      className="mt-1"
                      disabled={processingAction === 'saving-email-config'}
                      placeholder="your-app-password"
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEmailConfigOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={processingAction === 'saving-email-config'}>
                {processingAction === 'saving-email-config' ? 'Saving...' : 'Save Configuration'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Storage Location Dialog */}
      <Dialog open={isStorageDialogOpen} onOpenChange={setIsStorageDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Warehouse className="h-5 w-5 text-purple-600" />
              Add New Storage Location
            </DialogTitle>
            <DialogDescription>
              Create a new storage location for fish processing and storage
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleStorageSubmit(); }}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="storage_name" className="text-sm font-medium text-gray-700">Location Name *</Label>
                  <Input
                    id="storage_name"
                    value={storageForm.name}
                    onChange={(e) => setStorageForm({...storageForm, name: e.target.value})}
                    className="mt-1 border-gray-200 focus:border-purple-500 focus:ring-purple-500/20"
                    placeholder="e.g., Cold Storage A"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="storage_type" className="text-sm font-medium text-gray-700">Location Type *</Label>
                  <Select value={storageForm.location_type} onValueChange={(value: any) => setStorageForm({...storageForm, location_type: value})}>
                    <SelectTrigger className="mt-1 border-gray-200 focus:border-purple-500 focus:ring-purple-500/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cold_storage">Cold Storage</SelectItem>
                      <SelectItem value="freezer">Freezer</SelectItem>
                      <SelectItem value="ambient">Ambient</SelectItem>
                      <SelectItem value="processing_area">Processing Area</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="storage_description" className="text-sm font-medium text-gray-700">Description</Label>
                <Textarea
                  id="storage_description"
                  value={storageForm.description}
                  onChange={(e) => setStorageForm({...storageForm, description: e.target.value})}
                  className="mt-1 border-gray-200 focus:border-purple-500 focus:ring-purple-500/20"
                  placeholder="Brief description of this storage location"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="storage_capacity" className="text-sm font-medium text-gray-700">Capacity (kg) *</Label>
                  <Input
                    id="storage_capacity"
                    type="number"
                    min="1"
                    step="0.01"
                    value={storageForm.capacity_kg}
                    onChange={(e) => setStorageForm({...storageForm, capacity_kg: parseFloat(e.target.value) || 0})}
                    className="mt-1 border-gray-200 focus:border-purple-500 focus:ring-purple-500/20"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="storage_temperature" className="text-sm font-medium text-gray-700">Temperature (°C)</Label>
                  <Input
                    id="storage_temperature"
                    type="number"
                    step="0.1"
                    value={storageForm.temperature_celsius}
                    onChange={(e) => setStorageForm({...storageForm, temperature_celsius: parseFloat(e.target.value) || 0})}
                    className="mt-1 border-gray-200 focus:border-purple-500 focus:ring-purple-500/20"
                    placeholder="4.0"
                  />
                </div>
                <div>
                  <Label htmlFor="storage_humidity" className="text-sm font-medium text-gray-700">Humidity (%)</Label>
                  <Input
                    id="storage_humidity"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={storageForm.humidity_percent}
                    onChange={(e) => setStorageForm({...storageForm, humidity_percent: parseFloat(e.target.value) || 0})}
                    className="mt-1 border-gray-200 focus:border-purple-500 focus:ring-purple-500/20"
                    placeholder="85.0"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="storage_status" className="text-sm font-medium text-gray-700">Status</Label>
                <Select value={storageForm.status} onValueChange={(value: any) => setStorageForm({...storageForm, status: value})}>
                  <SelectTrigger className="mt-1 border-gray-200 focus:border-purple-500 focus:ring-purple-500/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsStorageDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={processingAction === 'saving-storage'} className="bg-purple-600 hover:bg-purple-700">
                {processingAction === 'saving-storage' ? 'Creating...' : 'Create Location'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Outlet Dialog */}
      <Dialog open={isOutletDialogOpen} onOpenChange={setIsOutletDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-purple-600" />
              {selectedOutlet ? 'Edit Outlet' : 'Add New Outlet'}
            </DialogTitle>
            <DialogDescription>
              {selectedOutlet ? 'Update outlet information' : 'Create a new retail outlet or distribution partner'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleOutletSubmit(); }}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="outlet_name">Outlet Name</Label>
                  <Input
                    id="outlet_name"
                    value={outletForm.name}
                    onChange={(e) => setOutletForm({...outletForm, name: e.target.value})}
                    placeholder="e.g., Nakuru Fresh Fish Market"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="outlet_location">Location</Label>
                  <Input
                    id="outlet_location"
                    value={outletForm.location}
                    onChange={(e) => setOutletForm({...outletForm, location: e.target.value})}
                    placeholder="e.g., Nakuru, Kenya"
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="outlet_phone">Phone Number</Label>
                <Input
                  id="outlet_phone"
                  value={outletForm.phone}
                  onChange={(e) => setOutletForm({...outletForm, phone: e.target.value})}
                  placeholder="e.g., +254722456789"
                  required
                />
              </div>
              <div>
                <Label htmlFor="outlet_manager_name">Manager Name (Optional)</Label>
                <Input
                  id="outlet_manager_name"
                  value={outletForm.manager_name}
                  onChange={(e) => setOutletForm({...outletForm, manager_name: e.target.value})}
                  placeholder="e.g., John Doe"
                />
              </div>
              <div>
                <Label htmlFor="outlet_status">Status</Label>
                <Select value={outletForm.status} onValueChange={(value: 'active' | 'inactive' | 'suspended') => setOutletForm({...outletForm, status: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsOutletDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={processingAction === 'saving-outlet'} className="bg-purple-600 hover:bg-purple-700">
                {processingAction === 'saving-outlet' ? 'Saving...' : selectedOutlet ? 'Update Outlet' : 'Create Outlet'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}