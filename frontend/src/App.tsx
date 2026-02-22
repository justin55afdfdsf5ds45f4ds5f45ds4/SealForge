import { useState } from 'react';
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import Dashboard from './components/Dashboard';
import ContentLibrary from './components/ContentLibrary';
import Marketplace from './components/Marketplace';
import ActivityFeed from './components/ActivityFeed';
import About from './components/About';

const tabs = ['Dashboard', 'Content', 'Marketplace', 'Activity', 'About'] as const;
type Tab = typeof tabs[number];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('Dashboard');
  const account = useCurrentAccount();

  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#0d1325]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-sm">SF</div>
            <h1 className="text-xl font-bold text-white">SealForge</h1>
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">testnet</span>
          </div>
          <ConnectButton />
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="border-b border-gray-800 bg-[#0d1325]">
        <div className="max-w-7xl mx-auto px-4 flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab
                  ? 'text-blue-400 border-blue-400'
                  : 'text-gray-400 border-transparent hover:text-gray-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'Dashboard' && <Dashboard />}
        {activeTab === 'Content' && <ContentLibrary />}
        {activeTab === 'Marketplace' && <Marketplace account={account} />}
        {activeTab === 'Activity' && <ActivityFeed />}
        {activeTab === 'About' && <About />}
      </main>
    </div>
  );
}
