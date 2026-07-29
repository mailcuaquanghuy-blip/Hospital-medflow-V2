import React, { useState } from 'react';
import { AppointmentTemplate, Procedure, Staff, Department, Appointment, Patient } from '../types';
import { Button } from './Button';
import { Search, Plus, Trash2, Edit3, FolderOpen, Save, X, ChevronDown, CheckCircle2, Copy, User, Monitor, ArrowRightLeft } from 'lucide-react';
import { getAbbreviation, calculateAge } from '../utils/timeUtils';
import { MOCK_PROCEDURES } from '../constants';
import { TemplateProcModal } from './TemplateProcModal';
import { TemplateProcedure } from '../types';

interface TemplateManagerProps {
  templates: AppointmentTemplate[];
  procedures: Procedure[];
  staff: Staff[];
  currentDept: Department;
  onSaveTemplate: (template: AppointmentTemplate, silent?: boolean) => void;
  onDeleteTemplate: (templateId: string) => void;
  appointments: Appointment[];
  patients: Patient[];
  activeDate: string;
  onApplyTemplateToPatient?: (patientId: string, templateId: string) => void;
}

export const TemplateManager: React.FC<TemplateManagerProps> = ({
  templates, procedures, staff, currentDept, onSaveTemplate, onDeleteTemplate, appointments, patients, activeDate, onApplyTemplateToPatient
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<Partial<AppointmentTemplate> | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  
  const deptTemplates = templates.filter(t => t.deptId === currentDept.id);
  
  const visiblePatients = patients.filter(p => {
    // Bệnh nhân chưa vào viện vào thời điểm activeDate
    const admissionDateStr = p.admissionDate.split('T')[0];
    if (activeDate < admissionDateStr) return false;

    // Basic visibility check similar to PatientScheduling
    const isDischargedBeforeToday = p.status === 'DISCHARGED' && (!p.dischargeDate || activeDate > p.dischargeDate.split('T')[0]);
    if (isDischargedBeforeToday) return false;

    // Check if in current dept OR referred to current dept
    const isAdmittedByDept = p.admittedByDeptId === currentDept.id;
    const isReferredToDept = p.referrals?.some(r => {
        const s = (r.specialty || '').toLowerCase().trim();
        const dId = currentDept.id.toLowerCase().trim();
        const dName = currentDept.name.toLowerCase().trim();
        const isMatch = s === dId || s === dName || dName.includes(s) || s.includes(dName);
        if (!isMatch) return false;
        const refDate = r.referralDate || p.admissionDate.split('T')[0];
        if (activeDate < refDate) return false;
        if (r.status === 'FINISHED' && r.finishedDate && activeDate > r.finishedDate) return false;
        return true;
    });

    return isAdmittedByDept || isReferredToDept;
  });

  const patientsNoAppointments = visiblePatients.filter(p => {
    const hasAppts = appointments.some(a => a.patientId === p.id && a.date === activeDate && a.deptId === currentDept.id);
    return !hasAppts;
  });

  const groupedTemplates = deptTemplates.reduce((acc, template) => {
    if (template.isFolder) {
      if (!acc[template.name]) acc[template.name] = [];
      return acc;
    }
    const group = template.group || 'Khác';
    if (!acc[group]) acc[group] = [];
    acc[group].push(template);
    return acc;
  }, {} as Record<string, AppointmentTemplate[]>);

  const getGroupDepth = (group: string) => group.split('/').filter(Boolean).length - 1;
  const getGroupNameOnly = (group: string) => {
    if (group === 'Khác') return 'Khác';
    const parts = group.split('/').filter(Boolean);
    return parts[parts.length - 1];
  };

  const getGroupOrder = (groupName: string) => {
    if (groupName === 'Khác') return 999999;
    const folder = templates.find(t => t.isFolder && t.name === groupName && t.deptId === currentDept.id);
    return folder?.order ?? 0;
  };

  const sortedGroups = Object.entries(groupedTemplates)
    .sort(([g1], [g2]) => {
      if (g1 === 'Khác') return 1;
      if (g2 === 'Khác') return -1;
      
      // Sort by hierarchy first, then order
      const parts1 = g1.split('/').filter(Boolean);
      const parts2 = g2.split('/').filter(Boolean);
      
      const minLen = Math.min(parts1.length, parts2.length);
      for (let i = 0; i < minLen; i++) {
        if (parts1[i] !== parts2[i]) {
          const path1 = parts1.slice(0, i + 1).join('/');
          const path2 = parts2.slice(0, i + 1).join('/');
          const order1 = getGroupOrder(path1);
          const order2 = getGroupOrder(path2);
          if (order1 !== order2) return order1 - order2;
          return parts1[i].localeCompare(parts2[i], 'vi');
        }
      }
      return parts1.length - parts2.length;
    });

  const handleCreateNew = (groupName?: string) => {
    const newTemplate: Partial<AppointmentTemplate> = {
      name: 'Mẫu mới',
      group: typeof groupName === 'string' ? groupName : '',
      deptId: currentDept.id,
      procedures: []
    };
    setEditingTemplate(newTemplate);
    setSelectedTemplateId(null);
  };

  const [draggedItem, setDraggedItem] = useState<{type: 'group' | 'template' | 'patient', id: string, originGroup?: string} | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{type: 'group' | 'template', id: string} | null>(null);

  const handleDragStart = (e: React.DragEvent, type: 'group' | 'template' | 'patient', id: string, originGroup?: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id); // Required for HTML5 drag & drop to work
    setDraggedItem({ type, id, originGroup });
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverTarget(null);
  };

  const handleDragOver = (e: React.DragEvent, type: 'group' | 'template', id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedItem && draggedItem.id !== id) {
      if (draggedItem.type === 'group' && type === 'template') return;
      if (draggedItem.type === 'patient' && type === 'group') return;
      setDragOverTarget({ type, id });
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only reset if exiting the bounds of the element
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    if (e.clientX <= rect.left || e.clientX >= rect.right || e.clientY <= rect.top || e.clientY >= rect.bottom) {
      setDragOverTarget(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetType: 'group' | 'template', targetId: string) => {
    e.preventDefault();
    setDragOverTarget(null);
    if (!draggedItem) return;

    if (draggedItem.type === 'patient' && targetType === 'template') {
       if (onApplyTemplateToPatient) {
           onApplyTemplateToPatient(draggedItem.id, targetId);
       }
       setDraggedItem(null);
       return;
    }

    if (draggedItem.type === 'template' && targetType === 'group') {
      const t1 = templates.find(t => t.id === draggedItem.id);
      if (t1) {
        const newGroup = targetId === 'Khác' ? undefined : targetId;
        onSaveTemplate({ ...t1, group: newGroup, order: 9999 }, true);
      }
    } else if (draggedItem.type === targetType) {
       if (draggedItem.id === targetId) return;

       if (draggedItem.type === 'group') {
      const g1 = draggedItem.id;
      const g2 = targetId;
      if (g1 === 'Khác' || g2 === 'Khác') return;
      if (getGroupDepth(g1) !== 0) return; // Chỉ reorder nhóm cấp 1

      const top2 = g2.split('/')[0];
      if (g1 === top2) return;

      const topLevelGroups = Array.from(new Set(sortedGroups.map(g => g[0].split('/')[0]).filter(g => g !== 'Khác')));
      const newNames = topLevelGroups.filter(g => g !== g1);
      newNames.splice(newNames.indexOf(top2), 0, g1);
      
      newNames.forEach((name, index) => {
         const f = templates.find(t => t.isFolder && t.name === name && t.deptId === currentDept.id);
         if (f && (f.order !== index * 10)) {
            onSaveTemplate({ ...f, order: index * 10 }, true);
         }
      });
    } else if (draggedItem.type === 'template') {
      const t1 = templates.find(t => t.id === draggedItem.id);
      const t2 = templates.find(t => t.id === targetId);
      if (t1 && t2) {
        const targetGroup = t2.group || 'Khác';
        let allTmplsInTarget = groupedTemplates[targetGroup] || [];
        allTmplsInTarget = [...allTmplsInTarget].sort((a,b) => {
           const oa = a.order ?? 0; const ob = b.order ?? 0;
           return oa !== ob ? oa - ob : a.name.localeCompare(b.name, 'vi');
        });
        
        const filtered = allTmplsInTarget.filter(t => t.id !== t1.id);
        const idxTarget = filtered.findIndex(t => t.id === t2.id);
        const insertPos = idxTarget !== -1 ? idxTarget : filtered.length;
        
        filtered.splice(insertPos, 0, t1);
        
        filtered.forEach((t, index) => {
           const newGroup = targetGroup === 'Khác' ? undefined : targetGroup;
           if (t.order !== index * 10 || t.group !== newGroup) {
               onSaveTemplate({ ...t, order: index * 10, group: newGroup }, true);
           }
        });
      }
    }
  }

    setDraggedItem(null);
  };

  const handleCreateFolder = (initName?: string) => {
    let name = initName;
    if (name === undefined) {
      name = prompt("Nhập tên nhóm mẫu mới (Dùng / để tạo nhóm con, VD: PHCN/Dòng điện):") || undefined;
    }
    
    if (!name?.trim()) return;
    const trimmedName = name.trim();
    
    // Check if a folder with this exact name already exists
    const existingFolder = templates.find(t => t.isFolder && t.name === trimmedName && t.deptId === currentDept.id);
    if (existingFolder) {
      alert("Nhóm này đã tồn tại.");
      return;
    }

    const folderTemplate: AppointmentTemplate = {
      id: 'tmpl_f_' + Math.random().toString(36).substr(2, 9),
      name: trimmedName,
      deptId: currentDept.id,
      procedures: [],
      isFolder: true
    };
    onSaveTemplate(folderTemplate);
  };

  const handleRenameFolder = (groupName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const folderTmpl = deptTemplates.find(t => t.isFolder && t.name === groupName);
    if (!folderTmpl) {
      alert("Chỉ có thể đổi tên các nhóm được định nghĩa bằng thư mục.");
      return;
    }
    const newName = prompt(`Nhập tên mới cho nhóm "${groupName}":`, groupName);
    if (!newName || newName.trim() === '' || newName.trim() === groupName) return;
    
    const trimmedNewName = newName.trim();
    if (deptTemplates.some(t => t.isFolder && t.name === trimmedNewName)) {
      alert("Tên nhóm này đã tồn tại!");
      return;
    }

    // Update all folders and templates that start with this group name
    const relatedItems = deptTemplates.filter(t => 
      t.name === groupName || (t.isFolder && t.name.startsWith(groupName + '/')) || (!t.isFolder && t.group?.startsWith(groupName))
    );
    
    relatedItems.forEach(item => {
      if (item.isFolder) {
        let newFolderName = item.name;
        if (item.name === groupName) {
          newFolderName = trimmedNewName;
        } else if (item.name.startsWith(groupName + '/')) {
          newFolderName = trimmedNewName + item.name.substring(groupName.length);
        }
        onSaveTemplate({ ...item, name: newFolderName }, true);
      } else {
        let newGroup = item.group || '';
        if (newGroup === groupName) {
          newGroup = trimmedNewName;
        } else if (newGroup.startsWith(groupName + '/')) {
          newGroup = trimmedNewName + newGroup.substring(groupName.length);
        }
        onSaveTemplate({ ...item, group: newGroup }, true);
      }
    });
  };

  const handleMoveFolder = (groupName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const folderTmpl = deptTemplates.find(t => t.isFolder && t.name === groupName);
    if (!folderTmpl) {
      alert("Chỉ có thể chuyển các nhóm được định nghĩa bằng thư mục.");
      return;
    }
    
    // Get list of other top-level folders (or any folder)
    const possibleParents = Array.from(new Set(deptTemplates
      .filter(t => t.isFolder && t.name !== groupName && !t.name.startsWith(groupName + '/'))
      .map(t => t.name)
    ));
    
    if (possibleParents.length === 0) {
      alert("Không có nhóm nào khác để chuyển đến.");
      return;
    }
    
    const parentListStr = possibleParents.map((p, i) => `${i + 1}. ${p}`).join('\n');
    const input = prompt(`Chọn nhóm đích để chuyển "${groupName}" vào (nhập số thứ tự):\n0. Đưa ra ngoài cùng (không nằm trong nhóm nào)\n${parentListStr}`);
    
    if (input === null) return;
    
    const choiceIdx = parseInt(input.trim());
    if (isNaN(choiceIdx) || choiceIdx < 0 || choiceIdx > possibleParents.length) {
      alert("Lựa chọn không hợp lệ.");
      return;
    }
    
    let newParent = "";
    if (choiceIdx > 0) {
      newParent = possibleParents[choiceIdx - 1];
    }
    
    const folderBaseName = groupName.split('/').pop() || groupName;
    const newGroupName = newParent ? `${newParent}/${folderBaseName}` : folderBaseName;
    
    if (newGroupName === groupName) return;
    
    if (deptTemplates.some(t => t.isFolder && t.name === newGroupName)) {
      alert("Tên nhóm này đã tồn tại ở đích đến!");
      return;
    }

    // Update all folders and templates that start with this group name
    const relatedItems = deptTemplates.filter(t => 
      t.name === groupName || (t.isFolder && t.name.startsWith(groupName + '/')) || (!t.isFolder && (t.group === groupName || t.group?.startsWith(groupName + '/')))
    );
    
    relatedItems.forEach(item => {
      if (item.isFolder) {
        let newFolderName = item.name;
        if (item.name === groupName) {
          newFolderName = newGroupName;
        } else if (item.name.startsWith(groupName + '/')) {
          newFolderName = newGroupName + item.name.substring(groupName.length);
        }
        if (item.name !== newFolderName) {
          onSaveTemplate({ ...item, name: newFolderName }, true);
        }
      } else {
        let newGroup = item.group || '';
        if (newGroup === groupName) {
          newGroup = newGroupName;
        } else if (newGroup.startsWith(groupName + '/')) {
          newGroup = newGroupName + newGroup.substring(groupName.length);
        }
        if (item.group !== newGroup) {
          onSaveTemplate({ ...item, group: newGroup }, true);
        }
      }
    });
  };

  const handleDeleteFolder = (groupName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const folderTmpl = deptTemplates.find(t => t.isFolder && t.name === groupName);
    if (!folderTmpl) {
      alert("Chỉ có thể xóa các nhóm được định nghĩa bằng thư mục.");
      return;
    }
    
    // Check for any templates or sub-folders
    const hasTemplates = deptTemplates.some(t => !t.isFolder && (t.group === groupName || t.group?.startsWith(groupName + '/')));
    const hasSubFolders = deptTemplates.some(t => t.isFolder && t.name.startsWith(groupName + '/'));

    if (hasTemplates || hasSubFolders) {
      alert("Phải xóa tất cả mẫu và nhóm con bên trong trước khi xóa nhóm này.");
      return;
    }

    if (confirm(`Bạn có chắc muốn xóa nhóm "${groupName}" không?`)) {
      onDeleteTemplate(folderTmpl.id);
    }
  };

  const handleSelectTemplate = (template: AppointmentTemplate) => {
    setSelectedTemplateId(template.id);
    setEditingTemplate({
      ...template,
      procedures: JSON.parse(JSON.stringify(template.procedures))
    });
  };

  const handleSave = () => {
    if (!editingTemplate || !editingTemplate.name) return;
    
    const templateToSave: AppointmentTemplate = {
      id: editingTemplate.id || 'tmpl_' + Math.random().toString(36).substr(2, 9),
      name: editingTemplate.name,
      group: editingTemplate.group || 'Khác',
      deptId: currentDept.id,
      procedures: editingTemplate.procedures || []
    };

    onSaveTemplate(templateToSave);
    setSelectedTemplateId(templateToSave.id);
    setEditingTemplate(templateToSave);
  };

  const [isProcModalOpen, setIsProcModalOpen] = useState(false);
  const [editingProcIndex, setEditingProcIndex] = useState<number | null>(null);

  const addProcedure = () => {
    setEditingProcIndex(null);
    setIsProcModalOpen(true);
  };

  const handleSaveProc = (proc: TemplateProcedure) => {
    if (!editingTemplate) return;
    const newProcs = [...(editingTemplate.procedures || [])];
    if (editingProcIndex !== null) {
      newProcs[editingProcIndex] = proc;
    } else {
      newProcs.push(proc);
    }
    setEditingTemplate({...editingTemplate, procedures: newProcs});
    setIsProcModalOpen(false);
  };

  const handleEditProc = (index: number) => {
    setEditingProcIndex(index);
    setIsProcModalOpen(true);
  };

  return (
    <div className="flex flex-1 min-h-0 h-full gap-6 bg-transparent overflow-hidden">
      {/* List Panel */}
      <div className="flex-[3] bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col overflow-hidden shrink-0">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-slate-800 text-[11px] uppercase tracking-widest flex items-center gap-2">
              <FolderOpen size={14} className="text-emerald-600" /> Quản lý danh sách mẫu
            </h3>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => handleCreateFolder()} className="p-1 px-2 text-[11px]">
                + Tạo nhóm
              </Button>
              <Button size="sm" onClick={() => handleCreateNew()} className="bg-emerald-600 hover:bg-emerald-700 text-white p-1 px-2 text-[11px]">
                + Thêm mẫu
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder="Tìm kiếm mẫu..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all font-medium text-slate-700"
            />
          </div>
        </div>
        {patientsNoAppointments.length > 0 && (
          <div className="p-4 border-b border-rose-100 bg-rose-50/30 shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-4 bg-rose-400 rounded-full"></div>
              <h4 className="text-[11px] font-black uppercase text-rose-600 tracking-wider">BN chưa có chỉ định hôm nay</h4>
              <span className="text-[10px] text-rose-500 font-bold ml-auto bg-rose-100/80 px-2 py-0.5 rounded-full">{patientsNoAppointments.length}</span>
            </div>
            <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-thin">
              {patientsNoAppointments.map(p => (
                <div key={p.id} 
                  className="min-w-[150px] flex flex-col p-2 bg-white border border-rose-100 shadow-sm rounded-xl shrink-0 cursor-grab active:cursor-grabbing hover:border-emerald-300 transition-colors"
                  draggable
                  onDragStart={(e) => handleDragStart(e, 'patient', p.id)}
                  onDragEnd={handleDragEnd}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-slate-700 truncate">{p.name}</span>
                    <span className="text-[10px] text-slate-500 font-bold">{calculateAge(p.dob)} tuổi</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-emerald-600 font-black bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100">G.{p.bedNumber || '?'}</span>
                    <span className={`text-[8px] font-black px-1 py-0.5 rounded uppercase ${
                      p.bedType === 'Nội trú ban ngày' 
                        ? 'bg-amber-100 text-amber-700' 
                        : p.bedType === 'Ngoại trú'
                        ? 'bg-blue-100 text-blue-700'
                        : p.bedType === 'Khác'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {p.bedType || 'Nội trú'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex-1 overflow-y-auto w-full p-0">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white shadow-sm z-10 w-full">
              <tr className="border-b border-slate-200 text-[10px] font-black tracking-widest uppercase text-slate-400">
                <th className="p-3 pl-4 w-[25%] border-r border-slate-100">Nhóm Mẫu</th>
                <th className="p-3 w-[40%] border-r border-slate-100">Các Mẫu Trong Nhóm</th>
                <th className="p-3 w-[35%]">BN Đang Sử Dụng (Hôm nay)</th>
              </tr>
            </thead>
            <tbody className="w-full text-sm">
              {(() => {
                const patientApptsOnDate = appointments.filter(a => a.date === activeDate && a.deptId === currentDept.id);
                const patientMap = new Map<string, { templateIds: Set<string>, procs: string[] }>();
                
                patientApptsOnDate.forEach(a => {
                  if (!patientMap.has(a.patientId)) patientMap.set(a.patientId, { templateIds: new Set(), procs: [] });
                  const pData = patientMap.get(a.patientId)!;
                  pData.procs.push(`${a.procedureId}_${a.startTime}_${a.endTime}`);
                  if (a.templateId) pData.templateIds.add(a.templateId);
                });

                if (sortedGroups.length === 0) {
                  return (
                    <tr>
                      <td colSpan={3} className="text-center p-8 text-slate-400 italic">Chưa có mẫu nào trong khoa.</td>
                    </tr>
                  );
                }

                const patientsUsedTemplates = new Set<string>();

                const renderedGroups = sortedGroups.map(([group, tmpls]) => {
                  const filteredTmpls = tmpls.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));
                  
                  // If searching and no templates match in this group, hide group completely (unless it's an empty folder and searching is empty)
                  if (searchTerm && filteredTmpls.length === 0) return null;
                  
                  const rowSpan = filteredTmpls.length + 1;

                  return (
                    <React.Fragment key={group}>
                      {filteredTmpls.length === 0 ? (
                        <tr className="border-b border-slate-100 group/row hover:bg-slate-50 transition-colors">
                          <td className={`p-3 pl-4 align-top border-r border-slate-100 bg-slate-50/50 ${dragOverTarget?.type === 'group' && dragOverTarget?.id === group ? 'ring-2 ring-inset ring-emerald-500 bg-emerald-50' : ''}`}
                            onDragOver={(e) => handleDragOver(e, 'group', group)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, 'group', group)}
                          >
                            <div 
                              className={`flex items-center justify-between group/group ${getGroupDepth(group) === 0 ? 'cursor-grab active:cursor-grabbing' : ''}`}
                              draggable={getGroupDepth(group) === 0}
                              onDragStart={(e) => {
                                if (getGroupDepth(group) === 0) handleDragStart(e, 'group', group);
                                else { e.preventDefault(); e.stopPropagation(); }
                              }}
                              onDragEnd={handleDragEnd}
                              style={{ paddingLeft: `${getGroupDepth(group) * 16}px` }}
                            >
                              <div className="flex items-center gap-2 overflow-hidden">
                                {getGroupDepth(group) > 0 && <span className="text-slate-300">└─</span>}
                                <span className={`font-bold truncate ${getGroupDepth(group) === 0 ? 'text-slate-800 text-sm' : 'text-slate-600'}`} title={group}>
                                  {getGroupNameOnly(group)}
                                </span>
                              </div>
                              {group !== 'Khác' && (
                                <div className="flex items-center gap-0.5 opacity-0 group-hover/group:opacity-100 transition-opacity">
                                  <button onClick={(e) => { e.stopPropagation(); const subName = prompt(`Nhập tên nhóm con cho "${group}":`); if (subName?.trim()) handleCreateFolder(group + '/' + subName.trim()); }} className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-100" title="Thêm nhóm con"><Plus size={13}/></button>
                                  {deptTemplates.some(t => t.isFolder && t.name === group) && (
                                    <>
                                      <button onClick={(e) => handleRenameFolder(group, e)} className="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-100" title="Sửa tên nhóm"><Edit3 size={13}/></button>
                                      <button onClick={(e) => handleMoveFolder(group, e)} className="p-1 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-100" title="Chuyển nhóm sang vị trí khác"><ArrowRightLeft size={13}/></button>
                                    </>
                                  )}
                                  <button onClick={(e) => handleDeleteFolder(group, e)} className="p-1 rounded text-rose-400 hover:text-rose-600 hover:bg-rose-100" title="Xóa nhóm"><Trash2 size={13}/></button>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className={`p-3 text-slate-400 italic text-xs align-top cursor-pointer ${dragOverTarget?.type === 'group' && dragOverTarget?.id === group ? 'ring-2 ring-inset ring-emerald-500 bg-emerald-50' : ''}`} colSpan={2} onClick={() => handleCreateNew(group)}
                            onDragOver={(e) => handleDragOver(e, 'group', group)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, 'group', group)}
                          >
                            <div className="flex items-center gap-1.5 hover:text-emerald-500 transition-colors">
                              <Plus size={14} /> Bấm để thêm mẫu mới vào nhóm này
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <>
                          {filteredTmpls.sort((a, b) => {
                            const orderA = a.order ?? 0;
                            const orderB = b.order ?? 0;
                            if (orderA !== orderB) return orderA - orderB;
                            return a.name.localeCompare(b.name, 'vi');
                          }).map((t, idx) => {
                          const templateProcIds = t.procedures.map(p => `${p.procedureId}_${p.startTime}_${p.endTime}`);
                          let usedCount = 0;
                          let usedByPatientIds: string[] = [];
                          
                          Array.from(patientMap.entries()).forEach(([pId, pData]) => {
                            if (pData.templateIds.has(t.id)) {
                              usedCount++;
                              usedByPatientIds.push(pId);
                              patientsUsedTemplates.add(pId);
                            } else if (templateProcIds.length > 0 && templateProcIds.every(id => pData.procs.includes(id))) {
                              usedCount++;
                              usedByPatientIds.push(pId);
                              patientsUsedTemplates.add(pId);
                            }
                          });
                          
                          const usedPatientNames = usedByPatientIds.map(id => patients.find(p => p.id === id)?.name).filter(Boolean);
                          const isUsedGlobal = usedCount > 0;

                          return (
                            <tr key={t.id} onClick={() => handleSelectTemplate(t)} className={`border-b border-slate-100 group/row cursor-pointer transition-colors ${selectedTemplateId === t.id ? 'bg-emerald-50/70' : 'hover:bg-slate-50'}`}>
                              {idx === 0 && (
                                <td rowSpan={rowSpan} className={`p-3 pl-4 align-top border-r border-slate-100 bg-white ${dragOverTarget?.type === 'group' && dragOverTarget?.id === group ? 'ring-2 ring-inset ring-emerald-500 bg-emerald-50' : ''}`}
                                  onDragOver={(e) => handleDragOver(e, 'group', group)}
                                  onDragLeave={handleDragLeave}
                                  onDrop={(e) => handleDrop(e, 'group', group)}
                                >
                                  <div 
                                    className={`flex items-center justify-between group/group ${getGroupDepth(group) === 0 ? 'cursor-grab active:cursor-grabbing' : ''}`}
                                    draggable={getGroupDepth(group) === 0}
                                    onDragStart={(e) => {
                                      if (getGroupDepth(group) === 0) handleDragStart(e, 'group', group);
                                      else { e.preventDefault(); e.stopPropagation(); }
                                    }}
                                    onDragEnd={handleDragEnd}
                                    style={{ paddingLeft: `${getGroupDepth(group) * 16}px` }}
                                  >
                                    <div className="flex items-center gap-2 overflow-hidden">
                                      {getGroupDepth(group) > 0 && <span className="text-slate-300">└─</span>}
                                      <span className={`font-bold truncate ${getGroupDepth(group) === 0 ? 'text-slate-800 text-sm' : 'text-slate-600'}`} title={group}>
                                        {getGroupNameOnly(group)}
                                      </span>
                                    </div>
                                    {group !== 'Khác' && (
                                      <div className="flex items-center gap-0.5 opacity-0 group-hover/group:opacity-100 transition-opacity shrink-0">
                                        <button onClick={(e) => { e.stopPropagation(); const subName = prompt(`Nhập tên nhóm con cho "${group}":`); if (subName?.trim()) handleCreateFolder(group + '/' + subName.trim()); }} className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-100" title="Thêm nhóm con"><Plus size={13}/></button>
                                        {deptTemplates.some(t => t.isFolder && t.name === group) && (
                                          <>
                                            <button onClick={(e) => handleRenameFolder(group, e)} className="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-100" title="Sửa tên nhóm"><Edit3 size={13}/></button>
                                            <button onClick={(e) => handleMoveFolder(group, e)} className="p-1 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-100" title="Chuyển nhóm sang vị trí khác"><ArrowRightLeft size={13}/></button>
                                          </>
                                        )}
                                        <button onClick={(e) => handleDeleteFolder(group, e)} className="p-1 rounded text-rose-400 hover:text-rose-600 hover:bg-rose-100" title="Xóa nhóm"><Trash2 size={13}/></button>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              )}
                              <td className={`p-3 align-top border-r border-slate-100 relative group/cell ${dragOverTarget?.type === 'template' && dragOverTarget?.id === t.id ? (draggedItem?.type === 'patient' ? 'ring-2 ring-inset ring-blue-500 bg-blue-50' : 'border-t-2 border-t-emerald-500') : ''}`}
                                onDragOver={(e) => handleDragOver(e, 'template', t.id)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, 'template', t.id)}
                              >
                                <div 
                                  className="flex flex-col cursor-grab active:cursor-grabbing"
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, 'template', t.id, group)}
                                  onDragEnd={handleDragEnd}
                                >
                                  <span className={`font-semibold text-sm ${selectedTemplateId === t.id ? 'text-emerald-700' : 'text-slate-800'}`}>
                                    {t.name}
                                  </span>
                                  <span className="text-[10px] text-slate-400">{t.procedures.length} thủ thuật</span>
                                </div>
                                <div className="absolute right-2 top-3 opacity-0 group-hover/cell:opacity-100 transition-opacity flex gap-1">
                                  <button onClick={(e) => { e.stopPropagation(); onDeleteTemplate(t.id); if (selectedTemplateId === t.id) setEditingTemplate(null); }} className="p-1.5 hover:bg-rose-100 text-rose-400 hover:text-rose-600 rounded-md shadow-sm bg-white border border-slate-200"><Trash2 size={12} /></button>
                                </div>
                              </td>
                              <td className={`p-3 align-top text-xs leading-relaxed ${isUsedGlobal ? 'font-medium text-emerald-700 bg-emerald-50/30' : 'text-slate-500'}`}>
                                {isUsedGlobal ? usedPatientNames.join(', ') : <span className="opacity-50 italic">Không có</span>}
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="border-b border-slate-100/50 group/row hover:bg-slate-50/50 transition-colors">
                          <td className={`p-3 text-slate-400 italic text-xs align-top cursor-pointer ${dragOverTarget?.type === 'group' && dragOverTarget?.id === group ? 'ring-2 ring-inset ring-emerald-500 bg-emerald-50' : ''}`} colSpan={2} onClick={() => handleCreateNew(group)}
                            onDragOver={(e) => handleDragOver(e, 'group', group)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, 'group', group)}
                          >
                            <div className="flex items-center gap-1.5 hover:text-emerald-500 transition-colors">
                              <Plus size={14} /> Bấm để thêm mẫu mới vào nhóm này
                            </div>
                          </td>
                        </tr>
                      </>
                    )}
                  </React.Fragment>
                  );
                });

                const patientsNotUsingTemplates = visiblePatients.filter(p => !patientsUsedTemplates.has(p.id));

                return (
                  <>
                    {renderedGroups}
                    {patientsNotUsingTemplates.length > 0 && !searchTerm && (
                      <tr className="border-t-2 border-slate-200 bg-amber-50/30 group hover:bg-amber-50/60 transition-colors">
                        <td colSpan={2} className="p-3 pl-4 align-top border-r border-slate-100">
                          <span className="font-bold text-amber-800">Những bệnh nhân chưa dùng mẫu</span>
                          <div className="text-[10px] text-amber-600/80 font-medium">Bao gồm bệnh nhân trống lịch trên dòng thời gian hoặc lịch chỉ định không thuộc mẫu cấu hình nào</div>
                        </td>
                        <td className="p-3 align-top text-xs leading-relaxed text-amber-700 font-medium">
                          {patientsNotUsingTemplates.map(p => p.name).join(', ')}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Editor Panel */}
      <div 
        className={`flex-[2] bg-white rounded-3xl shadow-sm border flex flex-col overflow-hidden min-w-[400px] transition-all ${dragOverTarget?.type === 'template' && dragOverTarget?.id === editingTemplate?.id && draggedItem?.type === 'patient' ? 'ring-2 ring-inset ring-blue-500 bg-blue-50 border-blue-500' : 'border-slate-200'}`}
        onDragOver={(e) => editingTemplate && handleDragOver(e, 'template', editingTemplate.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => editingTemplate && handleDrop(e, 'template', editingTemplate.id)}
      >
        {editingTemplate ? (
          <>
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-700">Chi tiết mẫu thủ thuật</h3>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setEditingTemplate(null)}>Hủy</Button>
                <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Save size={16} className="mr-2" /> Lưu mẫu
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Tên mẫu</label>
                  <input 
                    type="text"
                    value={editingTemplate.name || ''}
                    onChange={e => setEditingTemplate({...editingTemplate, name: e.target.value})}
                    placeholder="VD: Khám nội soi định kỳ..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-400 focus:bg-white transition-all font-medium"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Nhóm mẫu</label>
                  <div className="relative">
                    <input 
                      list="template-groups"
                      value={editingTemplate.group || ''}
                      onChange={e => setEditingTemplate({...editingTemplate, group: e.target.value})}
                      placeholder="Chọn hoặc nhập nhóm mẫu... (Dùng / cho nhóm con)"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-400 focus:bg-white transition-all font-medium"
                    />
                    <datalist id="template-groups">
                      {Object.keys(groupedTemplates)
                        .filter(g => g !== 'Khác')
                        .sort((a, b) => a.localeCompare(b, 'vi'))
                        .map(g => (
                          <option key={g} value={g}>{g}</option>
                      ))}
                    </datalist>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-bold text-slate-700">Danh sách thủ thuật</label>
                  <Button size="sm" onClick={addProcedure} className="bg-blue-50 text-blue-600 hover:bg-blue-100 border-none">
                    <Plus size={14} className="mr-1" /> Thêm dòng
                  </Button>
                </div>
                
                {editingTemplate.procedures && editingTemplate.procedures.length > 0 ? (
                  <div className="space-y-3">
                    {editingTemplate.procedures.map((tProc, idx) => {
                      const procInfo = procedures.find(p => p.id === tProc.procedureId);
                      const staffInfo = staff.find(s => s.id === tProc.staffId);
                      return (
                        <div key={idx} onClick={() => handleEditProc(idx)} className="p-4 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:shadow-md cursor-pointer transition-all flex justify-between items-center group relative overflow-hidden">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                          <div className="flex flex-col gap-1.5 flex-1 pl-1">
                            <span className="font-bold text-slate-800 text-sm flex items-center gap-2">
                              {procInfo?.name || 'Thủ thuật trống'}
                              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{tProc.startTime} - {tProc.endTime}</span>
                            </span>
                            <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                              <span className="flex items-center gap-1.5"><User size={14} className="text-emerald-500" /> {staffInfo?.name || 'Trống'}</span>
                              {tProc.assistant1Id && <span className="flex items-center gap-1.5 opacity-70"><User size={13} /> {staff.find(s => s.id === tProc.assistant1Id)?.name}</span>}
                              {tProc.assistant2Id && <span className="flex items-center gap-1.5 opacity-70"><User size={13} /> {staff.find(s => s.id === tProc.assistant2Id)?.name}</span>}
                              {tProc.assignedMachineId && <span className="flex items-center gap-1.5 opacity-70"><Monitor size={13} /> Chọn máy tự động ({tProc.assignedMachineId})</span>}
                            </div>
                          </div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const newProcs = [...editingTemplate.procedures!];
                              newProcs.splice(idx, 1);
                              setEditingTemplate({...editingTemplate, procedures: newProcs});
                            }}
                            className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            title="Xóa thủ thuật"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 flex flex-col items-center justify-center gap-2">
                     <FolderOpen size={30} className="text-slate-300" />
                     <p className="text-slate-500 font-medium">Chưa có thủ thuật nào trong mẫu.</p>
                     <Button size="sm" onClick={addProcedure} variant="secondary" className="mt-2 text-xs">Thêm thủ thuật</Button>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300 p-8 text-center bg-slate-50/50">
            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-xl border border-slate-100 mb-6 rotate-3">
              <FolderOpen size={40} className="text-slate-200" />
            </div>
            <p className="font-black text-xl text-slate-400 tracking-tight uppercase">Chọn mẫu để chỉnh sửa</p>
            <p className="text-sm mt-3 text-slate-400 font-medium max-w-sm">
              Bạn có thể tạo các mẫu thủ thuật dùng chung cho nhiều bệnh nhân và quản lý chúng theo nhóm nội trú, ngoại trú, v.v.
            </p>
          </div>
        )}
      </div>
      
      {isProcModalOpen && editingTemplate && (
        <TemplateProcModal
          isOpen={isProcModalOpen}
          onClose={() => setIsProcModalOpen(false)}
          onSave={handleSaveProc}
          staff={staff}
          procedures={procedures}
          currentDept={currentDept}
          initialData={editingProcIndex !== null ? editingTemplate.procedures![editingProcIndex] : undefined}
        />
      )}
    </div>
  );
};
