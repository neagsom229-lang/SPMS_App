// frontend/src/pages/ActivityLog.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { 
  Activity, Search, RefreshCw, Filter, X, 
  Clock, User, Eye, Trash2, Download, 
  AlertCircle, CheckCircle, Loader2,
  Calendar, ChevronRight, ArrowUp, ArrowDown,
  Grid3x3, List, ClipboardList, Shield, Zap,
  Sparkles, Award, Star, Gift, Heart,
  AlertTriangle, Key
} from 'lucide-react';
import '../styles/activitylog.css';
import apiClient from '../api/client';

// ============================================
// SHARED DATA HELPERS
// ============================================
const extractArrayData = (responseData, extraKeys = []) => {
  if (
    typeof responseData === "string" &&
    responseData.includes("<!DOCTYPE html>")
  ) {
    return null;
  }
  if (Array.isArray(responseData)) return responseData;
  if (responseData && typeof responseData === "object") {
    if (Array.isArray(responseData.data)) return responseData.data;
    for (const key of extraKeys) {
      if (Array.isArray(responseData[key])) return responseData[key];
    }
    if (responseData.data && typeof responseData.data === "object") {
      for (const key of extraKeys) {
        if (Array.isArray(responseData.data[key]))
          return responseData.data[key];
      }
      const values = Object.values(responseData.data);
      if (values.length > 0 && Array.isArray(values[0])) return values[0];
    }
  }
  return [];
};

// ============================================
// MAIN ACTIVITYLOG COMPONENT
// ============================================
const ActivityLog = () => {
  // ===== STATE =====
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [filterTable, setFilterTable] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [viewMode, setViewMode] = useState('list');
  const [selectedLogs, setSelectedLogs] = useState([]);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedLogDetail, setSelectedLogDetail] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // ===== REFS =====
  const isMounted = useRef(true);
  const searchTimeout = useRef(null);
  const headerRef = useRef(null);
  const messageTimeout = useRef(null);

  // ===== MOUSE TRACKING =====
  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // ===== SHOW MESSAGE =====
  const showMessage = useCallback((text, type = 'success') => {
    setMessage(text);
    setMessageType(type);
    if (messageTimeout.current) clearTimeout(messageTimeout.current);
    messageTimeout.current = setTimeout(() => setMessage(''), 5000);
    if (type === 'success') toast.success(text);
    else if (type === 'error') toast.error(text);
    else if (type === 'warning') toast.custom(text);
    else toast(text);
  }, []);

  // ===== NORMALIZE A LOG RECORD =====
  // Different endpoints/casings can send log_id/LOG_ID/id and
  // user_id/USER_ID — pin them down once here so every downstream
  // use (keys, filters, selection) agrees on the same field names.
  const normalizeLog = (log, index) => ({
    ...log,
    log_id: log.log_id ?? log.LOG_ID ?? log.id ?? `log-${index}`,
    user_id: log.user_id ?? log.USER_ID,
    username: log.username ?? log.USERNAME,
    action: log.action ?? log.ACTION,
    table_name: log.table_name ?? log.TABLE_NAME,
    record_id: log.record_id ?? log.RECORD_ID,
    action_date: log.action_date ?? log.ACTION_DATE ?? log.date,
  });

  // ===== NORMALIZE A USER RECORD =====
  const normalizeUser = (user, index) => ({
    ...user,
    user_id: user.user_id ?? user.USER_ID ?? user.id ?? `user-${index}`,
    username: user.username ?? user.USERNAME,
    fullname: user.fullname ?? user.FULLNAME,
  });

  // ===== FETCH ACTIVITY LOGS (REAL DATA ONLY - NO MOCK FALLBACK) =====
  const fetchActivityLogs = useCallback(async () => {
    if (!isMounted.current) return;
    setLoading(true);
    setIsRefreshing(true);
    
    try {
      const res = await apiClient.get('/activity-logs', {
        params: { limit: 200 }
      });
      
      if (isMounted.current) {
        const data = extractArrayData(res.data, ['logs', 'items', 'data']);
        const rawArray = Array.isArray(data) ? data : [];
        const logsArray = rawArray.map(normalizeLog);
        console.log(`📋 Activity logs loaded: ${logsArray.length}`);
        
        setLogs(logsArray);
        if (logsArray.length > 0) {
          showMessage(`✅ ${logsArray.length} logs loaded`, 'success');
        }
      }
    } catch (error) {
      console.error('❌ Error fetching activity logs:', error);
      if (isMounted.current) {
        setLogs([]);
        showMessage('❌ Failed to load activity logs from database', 'error');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [showMessage]);

  // ===== FETCH USERS =====
  const fetchUsers = useCallback(async () => {
    try {
      const res = await apiClient.get('/users');
      if (isMounted.current) {
        const data = extractArrayData(res.data, ['users', 'items', 'data']);
        const usersArray = Array.isArray(data) ? data.map(normalizeUser) : [];
        setUsers(usersArray);
        console.log(`👥 Users loaded: ${usersArray.length}`);
      }
    } catch (error) {
      console.error('❌ Error fetching users:', error);
      if (isMounted.current) {
        setUsers([]);
      }
    }
  }, []);

  // ===== INITIAL LOAD =====
  useEffect(() => {
    isMounted.current = true;
    fetchActivityLogs();
    fetchUsers();

    return () => {
      isMounted.current = false;
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
      if (messageTimeout.current) {
        clearTimeout(messageTimeout.current);
      }
    };
  }, [fetchActivityLogs, fetchUsers]);

  // ===== REFRESH =====
  const handleRefresh = useCallback(async () => {
    await fetchActivityLogs();
    await fetchUsers();
  }, [fetchActivityLogs, fetchUsers]);

  // ===== SEARCH DEBOUNCE =====
  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    searchTimeout.current = setTimeout(() => {
      // Search handled by useMemo
    }, 300);

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [searchTerm]);

  // ===== FILTERED & SORTED LOGS =====
  const filteredLogs = useMemo(() => {
    if (!Array.isArray(logs)) return [];
    
    let result = [...logs];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(log => {
        const username = log.username || '';
        const action = log.action || '';
        const table = log.table_name || '';
        const recordId = String(log.record_id || '');
        return username.toLowerCase().includes(term) ||
               action.toLowerCase().includes(term) ||
               table.toLowerCase().includes(term) ||
               recordId.includes(term);
      });
    }

    // Action filter
    if (filterAction !== 'all') {
      result = result.filter(log => log.action === filterAction);
    }

    // User filter
    if (filterUser !== 'all') {
      result = result.filter(log => String(log.user_id) === filterUser);
    }

    // Table filter
    if (filterTable !== 'all') {
      result = result.filter(log => log.table_name === filterTable);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      const aDate = a.action_date;
      const bDate = b.action_date;
      const aUser = a.username || '';
      const bUser = b.username || '';
      const aAction = a.action || '';
      const bAction = b.action || '';
      const aTable = a.table_name || '';
      const bTable = b.table_name || '';

      switch (sortBy) {
        case 'date':
          comparison = new Date(aDate) - new Date(bDate);
          break;
        case 'user':
          comparison = aUser.localeCompare(bUser);
          break;
        case 'action':
          comparison = aAction.localeCompare(bAction);
          break;
        case 'table':
          comparison = aTable.localeCompare(bTable);
          break;
        default:
          comparison = new Date(aDate) - new Date(bDate);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [logs, searchTerm, filterAction, filterUser, filterTable, sortBy, sortOrder]);

  // ===== CALCULATE STATS =====
  const stats = useMemo(() => {
    if (!Array.isArray(logs)) {
      return { total: 0, actionCounts: {}, userCounts: {}, tableCounts: {} };
    }
    
    const total = logs.length;
    const actionCounts = {};
    const userCounts = {};
    const tableCounts = {};

    logs.forEach(log => {
      const action = log.action || 'Unknown';
      const user = log.username || 'Unknown';
      const table = log.table_name || 'Unknown';
      
      actionCounts[action] = (actionCounts[action] || 0) + 1;
      userCounts[user] = (userCounts[user] || 0) + 1;
      tableCounts[table] = (tableCounts[table] || 0) + 1;
    });

    return { total, actionCounts, userCounts, tableCounts };
  }, [logs]);

  // ===== GET ACTION EMOJI =====
  const getActionEmoji = (action) => {
    const emojis = {
      'Login': '🔐',
      'Logout': '🚪',
      'Created customer': '👤',
      'Updated customer': '✏️',
      'Deleted customer': '🗑️',
      'Created product': '📦',
      'Updated product': '✏️',
      'Deleted product': '🗑️',
      'Created order': '🛒',
      'Updated order': '✏️',
      'Deleted order': '🗑️',
      'Created user': '👤',
      'Updated user': '✏️',
      'Deleted user': '🗑️',
    };
    return emojis[action] || '📋';
  };

  // ===== GET ACTION COLOR =====
  const getActionColor = (action) => {
    if (action?.includes('Created')) return 'text-emerald-500 dark:text-emerald-400';
    if (action?.includes('Updated')) return 'text-blue-500 dark:text-blue-400';
    if (action?.includes('Deleted')) return 'text-red-500 dark:text-red-400';
    if (action?.includes('Login')) return 'text-green-500 dark:text-green-400';
    if (action?.includes('Logout')) return 'text-orange-500 dark:text-orange-400';
    return 'text-purple-500 dark:text-purple-400';
  };

  // ===== GET ACTION BADGE =====
  const getActionBadge = (action) => {
    const colors = {
      'Login': 'badge badge-login',
      'Logout': 'badge badge-logout',
      'Created customer': 'badge badge-created',
      'Updated customer': 'badge badge-updated',
      'Deleted customer': 'badge badge-deleted',
      'Created product': 'badge badge-created',
      'Updated product': 'badge badge-updated',
      'Deleted product': 'badge badge-deleted',
      'Created order': 'badge badge-created',
      'Updated order': 'badge badge-updated',
      'Deleted order': 'badge badge-deleted',
      'Created user': 'badge badge-created',
      'Updated user': 'badge badge-updated',
      'Deleted user': 'badge badge-deleted',
    };
    return colors[action] || 'badge badge-default';
  };

  // ===== FORMAT DATE =====
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      if (isNaN(date)) return dateStr;
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  // ===== TIME AGO =====
  const timeAgo = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      return formatDate(dateStr);
    } catch {
      return dateStr;
    }
  };

  // ===== VIEW LOG DETAIL =====
  const viewLogDetail = (log) => {
    setSelectedLogDetail(log);
    setShowDetailModal(true);
  };

  // ===== TOGGLE SELECT =====
  const toggleSelect = (id) => {
    setSelectedLogs(prev => {
      if (prev.includes(id)) {
        return prev.filter(p => p !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  // ===== TOGGLE SELECT ALL =====
  const toggleSelectAll = () => {
    if (selectedLogs.length === filteredLogs.length) {
      setSelectedLogs([]);
    } else {
      setSelectedLogs(filteredLogs.map(log => log.log_id));
    }
  };

  // ===== EXPORT LOGS =====
  const exportLogs = () => {
    if (!filteredLogs.length) {
      showMessage('⚠️ No data to export', 'warning');
      return;
    }

    try {
      const headers = ['ID', 'User', 'Action', 'Table', 'Record ID', 'Date'];
      let csv = headers.join(',') + '\n';
      
      filteredLogs.forEach(log => {
        const row = [
          log.log_id || '',
          `"${log.username || 'Unknown'}"`,
          `"${log.action || ''}"`,
          `"${log.table_name || ''}"`,
          log.record_id || '',
          `"${formatDate(log.action_date)}"`
        ];
        csv += row.join(',') + '\n';
      });
      
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity_logs_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showMessage(`✅ ${filteredLogs.length} logs exported successfully!`, 'success');
    } catch (error) {
      console.error('Export error:', error);
      showMessage('❌ Failed to export logs', 'error');
    }
  };

  // ===== CLEAR SELECTED =====
  const clearSelected = () => {
    setSelectedLogs([]);
    showMessage('✅ Selection cleared', 'info');
  };

  // ===== GET UNIQUE ACTIONS =====
  const uniqueActions = useMemo(() => {
    if (!Array.isArray(logs)) return [];
    const actions = new Set();
    logs.forEach(log => {
      if (log.action) actions.add(log.action);
    });
    return Array.from(actions).sort();
  }, [logs]);

  // ===== GET UNIQUE TABLES =====
  const uniqueTables = useMemo(() => {
    if (!Array.isArray(logs)) return [];
    const tables = new Set();
    logs.forEach(log => {
      if (log.table_name) tables.add(log.table_name);
    });
    return Array.from(tables).sort();
  }, [logs]);

  // ===== GET USER NAME =====
  const getUserName = useCallback((userId) => {
    const user = users.find(u => String(u.user_id) === String(userId));
    return user?.username || user?.fullname || `User ${userId}`;
  }, [users]);

  // ===== LOADING =====
  if (loading) {
    return (
      <div className="activitylog-loading">
        <div className="activitylog-loading-spinner">
          <div className="activitylog-loading-ring">
            <div className="activitylog-loading-ring-inner" />
            <div className="activitylog-loading-ring-pulse" />
          </div>
        </div>
        <p className="activitylog-loading-text">Loading activity logs...</p>
        <div className="activitylog-loading-dots">
          <span className="activitylog-loading-dot" style={{ animationDelay: '0s' }} />
          <span className="activitylog-loading-dot" style={{ animationDelay: '0.2s' }} />
          <span className="activitylog-loading-dot" style={{ animationDelay: '0.4s' }} />
        </div>
      </div>
    );
  }

  // ===== RENDER =====
  return (
    <div className="activitylog-container">
      
      {/* ===== MESSAGE TOAST ===== */}
      {message && (
        <div className={`toast-message toast-${messageType}`}>
          <div className="toast-content">
            <div className="toast-icon">
              {messageType === 'success' && <CheckCircle className="w-5 h-5 text-green-500" />}
              {messageType === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
              {messageType === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-500" />}
              {messageType === 'info' && <Activity className="w-5 h-5 text-blue-500" />}
            </div>
            <div className="toast-text">{message}</div>
            <button onClick={() => setMessage('')} className="toast-close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ===== HEADER WITH STATS ===== */}
      <div 
        ref={headerRef}
        className="activitylog-header"
        style={{
          transform: `perspective(1000px) rotateX(${(mousePosition.y / window.innerHeight - 0.5) * 2}deg) rotateY(${(mousePosition.x / window.innerWidth - 0.5) * 2}deg)`,
          transition: 'transform 0.1s ease-out'
        }}
      >
        <div className="activitylog-header-bg">
          <div className="activitylog-header-bg-circle" />
          <div className="activitylog-header-bg-circle2" />
          <div className="activitylog-header-bg-circle3" />
        </div>

        <div className="activitylog-header-content">
          <div className="activitylog-header-left">
            <div className="activitylog-header-badge">
              <div className="activitylog-header-badge-dot" />
              <span className="activitylog-header-badge-text">Audit Trail</span>
            </div>
            <h1 className="activitylog-header-title">
              <Activity className="activitylog-header-icon" />
              Activity Logs
            </h1>
            <p className="activitylog-header-subtitle">Monitor all user activities and system events</p>
          </div>
          <div className="activitylog-header-actions">
            <div className="activitylog-header-time">
              <Clock className="w-4 h-4 text-white/80" />
              {new Date().toLocaleTimeString()}
            </div>
            <button 
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="activitylog-header-btn"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={exportLogs}
              className="activitylog-header-btn-primary"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="activitylog-stats">
          <div className="activitylog-stat-card">
            <p className="activitylog-stat-label">Total Activities</p>
            <p className="activitylog-stat-value">{stats.total}</p>
          </div>
          <div className="activitylog-stat-card">
            <p className="activitylog-stat-label">Unique Users</p>
            <p className="activitylog-stat-value">{Object.keys(stats.userCounts).length}</p>
          </div>
          <div className="activitylog-stat-card">
            <p className="activitylog-stat-label">Actions</p>
            <p className="activitylog-stat-value">{Object.keys(stats.actionCounts).length}</p>
          </div>
          <div className="activitylog-stat-card">
            <p className="activitylog-stat-label">Tables</p>
            <p className="activitylog-stat-value">{Object.keys(stats.tableCounts).length}</p>
          </div>
        </div>
      </div>

      {/* ===== CONTROLS ===== */}
      <div className="activitylog-controls">
        <div className="activitylog-controls-content">
          <div className="activitylog-controls-left">
            <div className="activitylog-search">
              <Search className="activitylog-search-icon" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="🔍 Search by user, action, table..."
                className="activitylog-search-input"
              />
            </div>

            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="activitylog-filter"
            >
              <option value="all">All Actions</option>
              {uniqueActions.map(action => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>

            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="activitylog-filter"
            >
              <option value="all">All Users</option>
              {users.map((user, index) => (
                <option key={user.user_id ?? `user-opt-${index}`} value={String(user.user_id)}>
                  {user.username || user.fullname || `User ${user.user_id}`}
                </option>
              ))}
            </select>

            <select
              value={filterTable}
              onChange={(e) => setFilterTable(e.target.value)}
              className="activitylog-filter"
            >
              <option value="all">All Tables</option>
              {uniqueTables.map(table => (
                <option key={table} value={table}>{table}</option>
              ))}
            </select>
          </div>

          <div className="activitylog-controls-right">
            <div className="activitylog-view-toggle">
              <button
                onClick={() => setViewMode('list')}
                className={`activitylog-view-btn ${viewMode === 'list' ? 'activitylog-view-active' : ''}`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`activitylog-view-btn ${viewMode === 'grid' ? 'activitylog-view-active' : ''}`}
                title="Grid view"
              >
                <Grid3x3 className="w-4 h-4" />
              </button>
            </div>

            {selectedLogs.length > 0 && (
              <button
                onClick={clearSelected}
                className="activitylog-clear-btn"
              >
                <X className="w-4 h-4" />
                Clear ({selectedLogs.length})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ===== LOGS GRID ===== */}
      {filteredLogs.length === 0 ? (
        <div className="activitylog-empty">
          <Activity className="activitylog-empty-icon" />
          <h3 className="activitylog-empty-title">No activity logs found</h3>
          <p className="activitylog-empty-text">
            {searchTerm || filterAction !== 'all' || filterUser !== 'all' || filterTable !== 'all' 
              ? 'Try adjusting your search or filters' 
              : 'Activities will appear here as users interact with the system'}
          </p>
        </div>
      ) : viewMode === 'list' ? (
        // ===== LIST VIEW =====
        <div className="activitylog-list-view">
          <div className="activitylog-list-table-wrapper">
            <table className="activitylog-list-table">
              <thead className="activitylog-list-thead">
                <tr>
                  <th className="activitylog-list-th w-10">
                    <input
                      type="checkbox"
                      checked={selectedLogs.length === filteredLogs.length && filteredLogs.length > 0}
                      onChange={toggleSelectAll}
                      className="activitylog-list-checkbox"
                    />
                  </th>
                  <th className="activitylog-list-th">User</th>
                  <th className="activitylog-list-th">Action</th>
                  <th className="activitylog-list-th hidden md:table-cell">Table</th>
                  <th className="activitylog-list-th hidden lg:table-cell">Record ID</th>
                  <th className="activitylog-list-th hidden sm:table-cell">Time</th>
                  <th className="activitylog-list-th text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="activitylog-list-tbody">
                {filteredLogs.map((log, index) => {
                  const id = log.log_id;
                  const isSelected = selectedLogs.includes(id);
                  const actionEmoji = getActionEmoji(log.action);
                  const username = log.username || 'Unknown';

                  return (
                    <tr 
                      key={id} 
                      className={`activitylog-list-tr ${isSelected ? 'activitylog-list-tr-selected' : ''}`}
                      style={{ animationDelay: `${index * 0.03}s` }}
                    >
                      <td className="activitylog-list-td w-10">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(id)}
                          className="activitylog-list-checkbox"
                        />
                      </td>
                      <td className="activitylog-list-td">
                        <div className="activitylog-list-user">
                          <div className="activitylog-list-avatar">
                            {username.charAt(0).toUpperCase()}
                          </div>
                          <span className="activitylog-list-username">
                            {username}
                          </span>
                        </div>
                      </td>
                      <td className="activitylog-list-td">
                        <span className={getActionBadge(log.action)}>
                          <span className="activitylog-action-emoji">{actionEmoji}</span>
                          {log.action || 'Unknown'}
                        </span>
                      </td>
                      <td className="activitylog-list-td hidden md:table-cell">
                        {log.table_name || '-'}
                      </td>
                      <td className="activitylog-list-td hidden lg:table-cell">
                        {log.record_id || '-'}
                      </td>
                      <td className="activitylog-list-td hidden sm:table-cell">
                        {timeAgo(log.action_date)}
                      </td>
                      <td className="activitylog-list-td text-center">
                        <button
                          onClick={() => viewLogDetail(log)}
                          className="activitylog-list-action"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // ===== GRID VIEW =====
        <div className="activitylog-grid-view">
          {filteredLogs.map((log, index) => {
            const id = log.log_id;
            const isSelected = selectedLogs.includes(id);
            const actionEmoji = getActionEmoji(log.action);
            const username = log.username || 'Unknown';

            return (
              <div
                key={id}
                className={`activitylog-grid-card ${isSelected ? 'activitylog-grid-card-selected' : ''}`}
                style={{ animationDelay: `${index * 0.04}s` }}
                onClick={() => toggleSelect(id)}
              >
                <div className="activitylog-grid-card-content">
                  <div className="activitylog-grid-card-header">
                    <div className="activitylog-grid-card-user">
                      <div className="activitylog-grid-card-avatar">
                        {actionEmoji}
                      </div>
                      <div>
                        <p className="activitylog-grid-card-username">
                          {username}
                        </p>
                        <p className="activitylog-grid-card-time">
                          {timeAgo(log.action_date)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        viewLogDetail(log);
                      }}
                      className="activitylog-grid-card-action"
                      title="View details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="activitylog-grid-card-action-badge">
                    <span className={getActionBadge(log.action)}>
                      {log.action || 'Unknown'}
                    </span>
                  </div>

                  <div className="activitylog-grid-card-details">
                    {log.table_name && (
                      <p className="activitylog-grid-card-detail">
                        <span className="activitylog-grid-card-detail-label">Table:</span>
                        <span className="activitylog-grid-card-detail-value">{log.table_name}</span>
                      </p>
                    )}
                    {log.record_id && (
                      <p className="activitylog-grid-card-detail">
                        <span className="activitylog-grid-card-detail-label">Record ID:</span>
                        <span className="activitylog-grid-card-detail-value font-mono">{log.record_id}</span>
                      </p>
                    )}
                  </div>

                  <div className="activitylog-grid-card-footer">
                    <p className="activitylog-grid-card-timestamp">
                      <Clock className="w-3 h-3" />
                      {formatDate(log.action_date)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== FOOTER ===== */}
      <div className="activitylog-footer">
        <p className="activitylog-footer-text">
          <span>📋 {filteredLogs.length} logs displayed</span>
          <span>•</span>
          <span>💾 {stats.total} total logs</span>
          <span>•</span>
          <span>👤 {Object.keys(stats.userCounts).length} unique users</span>
          <span>•</span>
          <span>📊 {Object.keys(stats.actionCounts).length} unique actions</span>
          <span>•</span>
          <span>{new Date().toLocaleString()}</span>
        </p>
      </div>

      {/* ===== LOG DETAIL MODAL ===== */}
      {showDetailModal && selectedLogDetail && (
        <div className="activitylog-modal-overlay">
          <div className="activitylog-modal-content">
            <div className="activitylog-modal-header">
              <h2 className="activitylog-modal-title">
                <Activity className="w-5 h-5 text-indigo-600" />
                Log Details
              </h2>
              <button 
                onClick={() => setShowDetailModal(false)}
                className="activitylog-modal-close"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="activitylog-modal-body">
              <div className="activitylog-modal-user">
                <div className="activitylog-modal-avatar">
                  {(selectedLogDetail.username || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="activitylog-modal-username">
                    {selectedLogDetail.username || 'Unknown'}
                  </p>
                  <p className="activitylog-modal-userid">
                    User ID: {selectedLogDetail.user_id ?? 'N/A'}
                  </p>
                </div>
              </div>

              <h3 className="activitylog-modal-section-title">
                <Zap className="w-4 h-4 text-amber-500" />
                Action Details
              </h3>
              <div className="activitylog-modal-action-details">
                <div className="activitylog-modal-action-item">
                  <span className="activitylog-modal-action-emoji">
                    {getActionEmoji(selectedLogDetail.action)}
                  </span>
                  <span className={`activitylog-modal-action-text ${getActionColor(selectedLogDetail.action)}`}>
                    {selectedLogDetail.action || 'Unknown'}
                  </span>
                </div>
                {selectedLogDetail.table_name && (
                  <div className="activitylog-modal-action-item">
                    <ClipboardList className="w-4 h-4 text-purple-500" />
                    <span className="activitylog-modal-action-text">
                      Table: <span className="font-medium">{selectedLogDetail.table_name}</span>
                    </span>
                  </div>
                )}
                {selectedLogDetail.record_id && (
                  <div className="activitylog-modal-action-item">
                    <Key className="w-4 h-4 text-amber-500" />
                    <span className="activitylog-modal-action-text">
                      Record ID: <span className="font-mono font-medium">{selectedLogDetail.record_id}</span>
                    </span>
                  </div>
                )}
              </div>

              <div className="activitylog-modal-timestamp">
                <p className="activitylog-modal-timestamp-label">Timestamp</p>
                <p className="activitylog-modal-timestamp-value">
                  {formatDate(selectedLogDetail.action_date)}
                </p>
              </div>
            </div>

            <div className="activitylog-modal-footer">
              <button 
                onClick={() => setShowDetailModal(false)}
                className="activitylog-modal-footer-btn"
              >
                <X className="w-4 h-4" />
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityLog;