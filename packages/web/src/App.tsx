import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { Layout } from './components/Layout';
import { ConfigPage } from './pages/ConfigPage';
import { DashboardPage } from './pages/DashboardPage';
import { LogsPage } from './pages/LogsPage';
import { PipelineListPage } from './pages/PipelineListPage';
import { PipelineDetailPage } from './pages/PipelineDetailPage';
import { PluginMarketPage } from './pages/PluginMarketPage';
import { PluginListPage } from './pages/PluginListPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { SetupPage } from './pages/SetupPage';
import { TaskDetailPage } from './pages/TaskDetailPage';
import { TasksPage } from './pages/TasksPage';

export default function App(): JSX.Element {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/pipelines" element={<PipelineListPage />} />
          <Route path="/pipelines/create" element={<PipelineDetailPage />} />
          <Route path="/pipelines/:id" element={<PipelineDetailPage />} />
          <Route path="/plugins" element={<PluginMarketPage />} />
          <Route path="/plugins/manage" element={<PluginListPage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
          <Route path="/config" element={<ConfigPage />} />
          <Route path="/logs" element={<LogsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
