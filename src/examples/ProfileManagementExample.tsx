import React, { useState } from 'react';
import { useAuth } from '../components/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

/**
 * Example component showing how to use the database-integrated authentication system
 * This demonstrates how user profiles are now stored in and retrieved from the database
 */
export function ProfileManagementExample() {
  const { user, updateUserProfile, refreshUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    phone: user?.phone || '',
    email: user?.email || ''
  });

  const handleSave = async () => {
    const result = await updateUserProfile({
      first_name: formData.first_name,
      last_name: formData.last_name,
      phone: formData.phone
    });

    if (result.success) {
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      phone: user?.phone || '',
      email: user?.email || ''
    });
    setIsEditing(false);
  };

  if (!user) {
    return <div>Please log in to view your profile</div>;
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>User Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isEditing ? (
          <>
            <div>
              <Label htmlFor="first_name">First Name</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="email">Email (Read-only)</Label>
              <Input
                id="email"
                value={formData.email}
                disabled
                className="bg-gray-100"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave}>Save</Button>
              <Button variant="outline" onClick={handleCancel}>Cancel</Button>
            </div>
          </>
        ) : (
          <>
            <div>
              <Label>Name</Label>
              <p className="text-sm text-gray-600">{user.first_name} {user.last_name}</p>
            </div>
            <div>
              <Label>Email</Label>
              <p className="text-sm text-gray-600">{user.email}</p>
            </div>
            <div>
              <Label>Phone</Label>
              <p className="text-sm text-gray-600">{user.phone || 'Not provided'}</p>
            </div>
            <div>
              <Label>Role</Label>
              <p className="text-sm text-gray-600 capitalize">{user.role.replace('_', ' ')}</p>
            </div>
            <div>
              <Label>Last Login</Label>
              <p className="text-sm text-gray-600">
                {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setIsEditing(true)}>Edit Profile</Button>
              <Button variant="outline" onClick={refreshUser}>Refresh</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
