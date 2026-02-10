import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, User, Key } from "lucide-react";
import { getErrorMessage } from "@/lib/error-utils";

interface StaffProfile {
  id: string;
  staff_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: string;
  branch_name?: string;
}

interface MyAccountPageProps {
  organizationId: string;
}

export default function MyAccountPage({ organizationId }: MyAccountPageProps) {
  const { toast } = useToast();
  const [profileData, setProfileData] = useState({ first_name: '', last_name: '', phone: '' });
  const [passwordData, setPasswordData] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [profileChanged, setProfileChanged] = useState(false);

  const { data: myProfile, isLoading } = useQuery<StaffProfile>({
    queryKey: ["/api/organizations", organizationId, "staff", "me"],
    enabled: !!organizationId,
  });

  useEffect(() => {
    if (myProfile) {
      setProfileData({
        first_name: myProfile.first_name || '',
        last_name: myProfile.last_name || '',
        phone: myProfile.phone || ''
      });
    }
  }, [myProfile]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof profileData) => {
      return apiRequest("PATCH", `/api/organizations/${organizationId}/staff/me`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "staff", "me"] });
      setProfileChanged(false);
      toast({ title: "Profile updated successfully" });
    },
    onError: (error: unknown) => {
      toast({ title: "Failed to update profile", description: getErrorMessage(error), variant: "destructive" });
    }
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { current_password: string; new_password: string }) => {
      return apiRequest("PUT", `/api/organizations/${organizationId}/staff/me/password`, data);
    },
    onSuccess: () => {
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
      toast({ title: "Password changed successfully" });
    },
    onError: (error: unknown) => {
      toast({ title: "Failed to change password", description: getErrorMessage(error), variant: "destructive" });
    }
  });

  const handleProfileChange = (field: string, value: string) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
    setProfileChanged(true);
  };

  const handleSaveProfile = () => {
    updateProfileMutation.mutate(profileData);
  };

  const handleChangePassword = () => {
    if (passwordData.new_password !== passwordData.confirm_password) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (passwordData.new_password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    changePasswordMutation.mutate({
      current_password: passwordData.current_password,
      new_password: passwordData.new_password
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-6">
        <PageHeader title="My Account" description="Manage your account settings" />
        <Card>
          <CardContent className="py-8 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!myProfile) {
    return (
      <div className="flex-1 p-6">
        <PageHeader title="My Account" description="Manage your account settings" />
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Staff profile not found
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-6">
      <PageHeader title="My Account" description="Manage your personal information and password" />
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            My Profile
          </CardTitle>
          <CardDescription>Update your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Staff Number</Label>
              <Input value={myProfile.staff_number} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={myProfile.email} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input 
                value={profileData.first_name} 
                onChange={(e) => handleProfileChange('first_name', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input 
                value={profileData.last_name} 
                onChange={(e) => handleProfileChange('last_name', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input 
                value={profileData.phone} 
                onChange={(e) => handleProfileChange('phone', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Input value={myProfile.role} disabled className="bg-muted capitalize" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button 
              onClick={handleSaveProfile} 
              disabled={!profileChanged || updateProfileMutation.isPending}
            >
              {updateProfileMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Profile
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Change Password
          </CardTitle>
          <CardDescription>Update your login password</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Current Password</Label>
              <Input 
                type="password" 
                value={passwordData.current_password}
                onChange={(e) => setPasswordData(prev => ({ ...prev, current_password: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input 
                type="password" 
                value={passwordData.new_password}
                onChange={(e) => setPasswordData(prev => ({ ...prev, new_password: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Confirm New Password</Label>
              <Input 
                type="password" 
                value={passwordData.confirm_password}
                onChange={(e) => setPasswordData(prev => ({ ...prev, confirm_password: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button 
              onClick={handleChangePassword} 
              disabled={!passwordData.current_password || !passwordData.new_password || changePasswordMutation.isPending}
            >
              {changePasswordMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Key className="mr-2 h-4 w-4" />}
              Change Password
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
