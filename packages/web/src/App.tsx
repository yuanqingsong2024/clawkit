import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { Layout } from './components/Layout';
import { ConfigPage } from './pages/ConfigPage';
import { DeployPage } from './pages/DeployPage';
import { HealPage } from './pages/HealPage';
import { OverviewPage } from './pages/OverviewPage';
import { SetupOpenClawPage } from './pages/SetupOpenClawPage';
import { SetupOpenCodePage } from './pages/SetupOpenCodePage';
import { SetupWizardPage } from './pages/SetupWizardPage';
import { StatusPage } from './pages/StatusPage';
import { TaskDetailPage } from './pages/TaskDetailPage';
import { TasksPage } from './pages/TasksPage';

export default function App(): JSX.Element {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/config" element={<ConfigPage />} />
          <Route path="/deploy" element={<DeployPage />} />
          <Route path="/setup" element={<SetupWizardPage />} />
          <Route path="/setup/openclaw" element={<SetupOpenClawPage />} />
          <Route path="/setup/opencode" element={<SetupOpenCodePage />} />
          <Route path="/heal" element={<HealPage />} />
          <Route path="/status" element={<StatusPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
