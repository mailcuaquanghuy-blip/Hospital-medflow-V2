import React, { useState, useRef } from 'react';
import { AppointmentTemplate, Procedure, Staff, Department, Appointment, Patient } from '../types';
import { Button } from './Button';
import { Search, Plus, Trash2, Edit3, FolderOpen, Save, X, ChevronDown, CheckCircle2, Copy, User, Monitor, ArrowRightLeft, FileSpreadsheet, Printer, Download, Upload } from 'lucide-react';
import { getAbbreviation, calculateAge, timeStringToMinutes } from '../utils/timeUtils';
import { downloadCSV } from '../utils/csvUtils';
import { MOCK_PROCEDURES } from '../constants';
import { TemplateProcModal } from './TemplateProcModal';
import { TemplateProcedure } from '../types';


const getLocalDateString = (isoStr: string | null | undefined): string => {
  if (!isoStr) return '';
  if (!isoStr.includes('T')) {
    return isoStr.split(' ')[0] || '';
  }
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) {
    return isoStr.split('T')[0] || '';
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportCSV = () => {
    try {
      const deptTemplates = templates.filter(t => t.deptId === currentDept.id && !t.isFolder);

      const sortedTemplates = [...deptTemplates].sort((a, b) => {
        const groupA = (a.group || 'Khác').trim();
        const groupB = (b.group || 'Khác').trim();
        const groupCmp = groupA.localeCompare(groupB, 'vi');
        if (groupCmp !== 0) return groupCmp;

        const nameA = (a.name || '').trim();
        const nameB = (b.name || '').trim();
        const nameCmp = nameA.localeCompare(nameB, 'vi');
        if (nameCmp !== 0) return nameCmp;

        return (a.order || 0) - (b.order || 0);
      });

      const rows: any[] = [];
      let stt = 1;

      sortedTemplates.forEach(t => {
        const procs = t.procedures || [];
        if (procs.length === 0) {
          rows.push({
            stt: stt++,
            groupName: t.group || 'Khác',
            templateName: t.name,
            dept: currentDept.name,
            procedure: 'Chưa thiết lập lịch trình',
            duration: '-',
            staff: '-',
            assistant1: '',
            assistant2: '',
            time: '-',
            machine: ''
          });
        } else {
          const sortedProcs = [...procs].sort((a, b) => 
            timeStringToMinutes(a.startTime) - timeStringToMinutes(b.startTime)
          );

          sortedProcs.forEach(tp => {
            const procInfo = procedures.find(p => p.id === tp.procedureId);
            const staffInfo = staff.find(s => s.id === tp.staffId);
            const asst1Info = tp.assistant1Id ? staff.find(s => s.id === tp.assistant1Id) : null;
            const asst2Info = tp.assistant2Id ? staff.find(s => s.id === tp.assistant2Id) : null;
            
            const durationMins = (timeStringToMinutes(tp.endTime) - timeStringToMinutes(tp.startTime));
            const durationStr = durationMins > 0 ? `${durationMins}p` : '-';
            const machineCode = tp.assignedMachineId ? tp.assignedMachineId.replace(/-/g, '') : '';

            rows.push({
              stt: stt++,
              groupName: t.group || 'Khác',
              templateName: t.name,
              dept: currentDept.name,
              procedure: procInfo?.name || 'Lịch trình đã xóa',
              duration: durationStr,
              staff: staffInfo?.name || '',
              assistant1: asst1Info?.name || '',
              assistant2: asst2Info?.name || '',
              time: `${tp.startTime} - ${tp.endTime}`,
              machine: machineCode
            });
          });
        }
      });

      const headers = [
        { label: 'STT', key: 'stt' },
        { label: 'Nhóm Mẫu', key: 'groupName' },
        { label: 'Tên Mẫu', key: 'templateName' },
        { label: 'Khoa thực hiện', key: 'dept' },
        { label: 'Lịch trình', key: 'procedure' },
        { label: 'Thời lượng', key: 'duration' },
        { label: 'Nhân viên', key: 'staff' },
        { label: 'Phụ 1', key: 'assistant1' },
        { label: 'Phụ 2', key: 'assistant2' },
        { label: 'Thời gian', key: 'time' },
        { label: 'Máy', key: 'machine' }
      ];

      downloadCSV(rows, `Danh_Sach_Mau_${currentDept.name.replace(/\s+/g, '_')}.csv`, headers);
    } catch (error) {
      console.error(error);
      alert('Lỗi khi xuất file CSV.');
    }
  };

  const handlePrintTemplates = () => {
    try {
      const deptTemplates = templates.filter(t => t.deptId === currentDept.id && !t.isFolder);
      
      const sortedTemplates = [...deptTemplates].sort((a, b) => {
        const groupA = (a.group || 'Khác').trim();
        const groupB = (b.group || 'Khác').trim();
        const groupCmp = groupA.localeCompare(groupB, 'vi');
        if (groupCmp !== 0) return groupCmp;

        const nameA = (a.name || '').trim();
        const nameB = (b.name || '').trim();
        const nameCmp = nameA.localeCompare(nameB, 'vi');
        if (nameCmp !== 0) return nameCmp;

        return (a.order || 0) - (b.order || 0);
      });

      let stt = 1;
      let tableRowsHTML = '';

      if (sortedTemplates.length === 0) {
        tableRowsHTML = `<tr>
          <td colspan="11" style="padding: 16px; font-style: italic; text-align: center; color: #64748b; border: 1px solid #cbd5e1;">
            Chưa có mẫu nào trong khoa.
          </td>
        </tr>`;
      } else {
        sortedTemplates.forEach(t => {
          const procs = t.procedures || [];
          if (procs.length === 0) {
            tableRowsHTML += `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">${stt++}</td>
                <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: bold; color: #334155;">${t.group || 'Khác'}</td>
                <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 600; color: #0f172a;">${t.name}</td>
                <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">${currentDept.name}</td>
                <td style="padding: 6px 8px; border: 1px solid #cbd5e1; color: #94a3b8; font-style: italic;" colspan="7">Chưa thiết lập lịch trình</td>
              </tr>
            `;
          } else {
            const sortedProcs = [...procs].sort((a, b) => 
              timeStringToMinutes(a.startTime) - timeStringToMinutes(b.startTime)
            );

            sortedProcs.forEach(tp => {
              const procInfo = procedures.find(p => p.id === tp.procedureId);
              const staffInfo = staff.find(s => s.id === tp.staffId);
              const asst1Info = tp.assistant1Id ? staff.find(s => s.id === tp.assistant1Id) : null;
              const asst2Info = tp.assistant2Id ? staff.find(s => s.id === tp.assistant2Id) : null;
              
              const durationMins = (timeStringToMinutes(tp.endTime) - timeStringToMinutes(tp.startTime));
              const durationStr = durationMins > 0 ? `${durationMins}p` : '-';
              const machineCode = tp.assignedMachineId ? tp.assignedMachineId.replace(/-/g, '') : '';

              tableRowsHTML += `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: 500;">${stt++}</td>
                  <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: bold; color: #334155;">${t.group || 'Khác'}</td>
                  <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 600; color: #0f172a;">${t.name}</td>
                  <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">${currentDept.name}</td>
                  <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 600; color: #1e293b;">${procInfo?.name || 'Lịch trình đã xóa'}</td>
                  <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">${durationStr}</td>
                  <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 500;">${staffInfo?.name || ''}</td>
                  <td style="padding: 6px 8px; border: 1px solid #cbd5e1; color: #475569;">${asst1Info?.name || ''}</td>
                  <td style="padding: 6px 8px; border: 1px solid #cbd5e1; color: #475569;">${asst2Info?.name || ''}</td>
                  <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: 500;">${tp.startTime} - ${tp.endTime}</td>
                  <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #0284c7;">${machineCode}</td>
                </tr>
              `;
            });
          }
        });
      }

      const printWindowHTML = `
        <html>
          <head>
            <title>In danh sách mẫu lịch trình</title>
            <style>
              @page {
                size: A4 landscape;
                margin: 10mm;
              }
              body {
                font-family: Arial, sans-serif;
                margin: 10px;
                background-color: #ffffff;
                color: #000000;
                font-size: 11px;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 15px;
                font-size: 11px;
              }
              th {
                background-color: #f1f5f9;
                color: #0f172a;
                font-weight: bold;
                border: 1px solid #cbd5e1;
                padding: 8px 6px;
                text-align: left;
                font-size: 11px;
              }
              td {
                border: 1px solid #cbd5e1;
                padding: 6px 8px;
              }
              @media print {
                body { margin: 0; }
              }
            </style>
          </head>
          <body>
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #334155; padding-bottom: 10px;">
              <div>
                <h1 style="font-size: 18px; font-weight: bold; text-transform: uppercase; color: #1e293b; margin: 0;">
                  DANH SÁCH MẪU CHỈ ĐỊNH LỊCH TRÌNH
                </h1>
                <p style="font-size: 12px; font-weight: bold; color: #475569; margin: 4px 0 0 0;">
                  KHOA: ${currentDept.name.toUpperCase()}
                </p>
              </div>
              <div style="text-align: right; font-size: 11px; color: #475569;">
                <p style="margin: 0;">Ngày in: ${new Date().toLocaleDateString('vi-VN')}</p>
                <p style="margin: 4px 0 0 0;">Giờ in: ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 3%; text-align: center;">STT</th>
                  <th style="width: 12%;">Nhóm Mẫu</th>
                  <th style="width: 15%;">Tên Mẫu</th>
                  <th style="width: 9%;">Khoa thực hiện</th>
                  <th style="width: 15%;">Lịch trình</th>
                  <th style="width: 6%; text-align: center;">Thời lượng</th>
                  <th style="width: 12%;">Nhân viên</th>
                  <th style="width: 9%;">Phụ 1</th>
                  <th style="width: 9%;">Phụ 2</th>
                  <th style="width: 7%; text-align: center;">Thời gian</th>
                  <th style="width: 3%; text-align: center;">Máy</th>
                </tr>
              </thead>
              <tbody>
                ${tableRowsHTML}
              </tbody>
            </table>

            <div style="margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px;">
              <div style="text-align: center; width: 200px;">
                <p style="font-weight: bold; margin: 0 0 50px 0;">Người lập bảng</p>
                <p style="font-style: italic; color: #64748b; font-size: 11px; margin: 0;">(Ký, ghi rõ họ tên)</p>
              </div>
              <div style="text-align: center; width: 250px;">
                <p style="font-style: italic; margin: 0 0 10px 0;">Ngày ..... tháng ..... năm 20...</p>
                <p style="font-weight: bold; margin: 0 0 50px 0;">Trưởng khoa / Trưởng bộ phận</p>
                <p style="font-style: italic; color: #64748b; font-size: 11px; margin: 0;">(Ký, đóng dấu)</p>
              </div>
            </div>
          </body>
        </html>
      `;

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (doc) {
        doc.open();
        doc.write(printWindowHTML);
        doc.close();

        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 1000);
        }, 500);
      } else {
        alert('Không thể tạo môi trường in.');
      }
    } catch (error) {
      console.error(error);
      alert('Lỗi khi in bảng mẫu.');
    }
  };

  const handleBackupTemplates = () => {
    try {
      const currentDeptTemplates = templates.filter(t => t.deptId === currentDept.id);
      const backupPayload = {
        version: '1.0',
        type: 'TEMPLATE_BACKUP',
        deptId: currentDept.id,
        deptName: currentDept.name,
        createdAt: new Date().toISOString(),
        templates: currentDeptTemplates
      };

      const jsonString = JSON.stringify(backupPayload, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const cleanDeptName = currentDept.name.replace(/[\/\\:*?"<>|]/g, '_').trim();
      const filename = `Sao_Luu_Mau_${cleanDeptName}_${new Date().toISOString().split('T')[0]}.json`;

      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error(error);
      alert('Lỗi khi tạo file sao lưu mẫu.');
    }
  };

  const handleRestoreTemplates = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json || json.type !== 'TEMPLATE_BACKUP' || !Array.isArray(json.templates)) {
          alert('Lỗi: File JSON không đúng định dạng sao lưu danh sách mẫu.');
          return;
        }

        const confirmMsg = `Bạn có chắc chắn muốn khôi phục ${json.templates.length} mẫu lịch trình từ file sao lưu của khoa "${json.deptName || json.deptId}" vào khoa hiện tại "${currentDept.name}" không?\n\n(Lưu ý: Các mẫu trùng ID sẽ được cập nhật/ghi đè)`;
        if (window.confirm(confirmMsg)) {
          let count = 0;
          for (const t of json.templates) {
            const restoredTemplate = {
              ...t,
              deptId: currentDept.id
            };
            onSaveTemplate(restoredTemplate, true);
            count++;
          }
          alert(`Khôi phục thành công ${count} mẫu lịch trình cho khoa ${currentDept.name}!`);
        }
      } catch (err) {
        console.error(err);
        alert('Lỗi đọc file JSON: File không hợp lệ.');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const deptTemplates = templates.filter(t => t.deptId === currentDept.id);
  
  const visiblePatients = patients.filter(p => {
    // Bệnh nhân chưa vào viện vào thời điểm activeDate
    const admissionDateStr = getLocalDateString(p.admissionDate);
    if (activeDate < admissionDateStr) return false;

    // Basic visibility check similar to PatientScheduling
    const isDischargedBeforeToday = p.status === 'DISCHARGED' && (!p.dischargeDate || activeDate > getLocalDateString(p.dischargeDate));
    if (isDischargedBeforeToday) return false;

    // Check if in current dept OR referred to current dept
    const isAdmittedByDept = p.admittedByDeptId === currentDept.id;
    const isReferredToDept = p.referrals?.some(r => {
        const s = (r.specialty || '').toLowerCase().trim();
        const dId = currentDept.id.toLowerCase().trim();
        const dName = currentDept.name.toLowerCase().trim();
        const isMatch = s === dId || s === dName || dName.includes(s) || s.includes(dName);
        if (!isMatch) return false;
        const refDate = r.referralDate || getLocalDateString(p.admissionDate);
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
      procedures: JSON.parse(JSON.stringify(template.procedures || []))
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
          <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-150 mt-1">
            <Button size="sm" onClick={handleExportCSV} variant="secondary" className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 p-1 px-2 text-[10px] uppercase font-black tracking-wider flex items-center gap-1 shadow-sm">
              <FileSpreadsheet size={13} className="text-emerald-600 shrink-0" /> Xuất CSV
            </Button>
            <Button size="sm" onClick={handlePrintTemplates} variant="secondary" className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 p-1 px-2 text-[10px] uppercase font-black tracking-wider flex items-center gap-1 shadow-sm">
              <Printer size={13} className="text-blue-600 shrink-0" /> In bảng mẫu
            </Button>
            <Button size="sm" onClick={handleBackupTemplates} variant="secondary" className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 p-1 px-2 text-[10px] uppercase font-black tracking-wider flex items-center gap-1 shadow-sm">
              <Download size={13} className="text-purple-600 shrink-0" /> Sao lưu mẫu
            </Button>
            <Button size="sm" onClick={() => fileInputRef.current?.click()} variant="secondary" className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 p-1 px-2 text-[10px] uppercase font-black tracking-wider flex items-center gap-1 shadow-sm">
              <Upload size={13} className="text-indigo-600 shrink-0" /> Khôi phục mẫu
            </Button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleRestoreTemplates} 
              accept=".json" 
              className="hidden" 
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
                          const templateProcIds = (t.procedures || []).map(p => `${p.procedureId}_${p.startTime}_${p.endTime}`);
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
                                  <span className="text-[10px] text-slate-400">{(t.procedures || []).length} lịch trình</span>
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
              <h3 className="font-bold text-slate-700">Chi tiết mẫu lịch trình</h3>
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
                  <label className="block text-sm font-bold text-slate-700">Danh sách lịch trình</label>
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
                              {procInfo?.name || 'Lịch trình trống'}
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
                            title="Xóa lịch trình"
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
                     <p className="text-slate-500 font-medium">Chưa có lịch trình nào trong mẫu.</p>
                     <Button size="sm" onClick={addProcedure} variant="secondary" className="mt-2 text-xs">Thêm lịch trình</Button>
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
              Bạn có thể tạo các mẫu lịch trình dùng chung cho nhiều bệnh nhân và quản lý chúng theo nhóm nội trú, ngoại trú, v.v.
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

      {/* Printable Area for Templates Table */}
      <div className="printable-area hidden">
        <div style={{ padding: '24px', fontFamily: 'sans-serif' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #334155', paddingBottom: '12px' }}>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 'bold', textTransform: 'uppercase', color: '#1e293b' }}>
                DANH SÁCH MẪU CHỈ ĐỊNH LỊCH TRÌNH
              </h1>
              <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginTop: '4px' }}>
                KHOA: {currentDept.name.toUpperCase()}
              </p>
            </div>
            <div style={{ textAlign: 'right', fontSize: '11px', color: '#64748b' }}>
              <p>Ngày in: {new Date().toLocaleDateString('vi-VN')}</p>
              <p>Giờ in: {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>

          <table style={{ width: '100%', marginTop: '24px', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #cbd5e1', textAlign: 'left', backgroundColor: '#f1f5f9' }}>
                <th style={{ padding: '10px', border: '1px solid #cbd5e1', width: '25%' }}>Nhóm Mẫu</th>
                <th style={{ padding: '10px', border: '1px solid #cbd5e1', width: '35%' }}>Tên Mẫu Lịch Trình</th>
                <th style={{ padding: '10px', border: '1px solid #cbd5e1', width: '40%' }}>Các Bước Lịch Trình Chi Tiết</th>
              </tr>
            </thead>
            <tbody>
              {templates.filter(t => t.deptId === currentDept.id).length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: '16px', fontStyle: 'italic', textAlign: 'center', color: '#64748b' }}>
                    Chưa có mẫu nào trong khoa.
                  </td>
                </tr>
              ) : (
                templates.filter(t => t.deptId === currentDept.id).map(t => {
                  if (t.isFolder) return null;
                  return (
                    <tr key={t.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px', border: '1px solid #cbd5e1', fontWeight: 'bold', color: '#334155' }}>
                        {t.group || 'Khác'}
                      </td>
                      <td style={{ padding: '10px', border: '1px solid #cbd5e1', fontWeight: '600', color: '#0f172a' }}>
                        {t.name}
                      </td>
                      <td style={{ padding: '10px', border: '1px solid #cbd5e1', color: '#334155' }}>
                        <ol style={{ margin: 0, paddingLeft: '16px' }}>
                          {(t.procedures || []).map((tp, idx) => {
                            const procInfo = procedures.find(p => p.id === tp.procedureId);
                            const staffInfo = staff.find(s => s.id === tp.staffId);
                            return (
                              <li key={idx} style={{ marginBottom: '4px' }}>
                                <strong>{procInfo?.name || 'Lịch trình trống'}</strong> ({tp.startTime} - {tp.endTime}) 
                                {staffInfo ? ` - Thực hiện: ${staffInfo.name}` : ''}
                                {tp.notes ? ` (Ghi chú: ${tp.notes})` : ''}
                              </li>
                            );
                          })}
                        </ol>
                        {(t.procedures || []).length === 0 && (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Chưa thiết lập lịch trình</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          
          <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <div style={{ textAlign: 'center', width: '200px' }}>
              <p style={{ fontWeight: 'bold' }}>Người lập bảng</p>
              <p style={{ fontStyle: 'italic', color: '#64748b', fontSize: '10px' }}>(Ký, ghi rõ họ tên)</p>
            </div>
            <div style={{ textAlign: 'center', width: '250px' }}>
              <p style={{ fontStyle: 'italic' }}>Ngày ..... tháng ..... năm 20...</p>
              <p style={{ fontWeight: 'bold' }}>Trưởng khoa / Trưởng bộ phận</p>
              <p style={{ fontStyle: 'italic', color: '#64748b', fontSize: '10px' }}>(Ký, đóng dấu)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
