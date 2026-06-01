import { use } from 'react';

import { GroupDashboard } from '@/features/groups/components/group-dashboard';

export default function GroupPage({ params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = use(params);
  return <GroupDashboard groupId={uuid} />;
}
