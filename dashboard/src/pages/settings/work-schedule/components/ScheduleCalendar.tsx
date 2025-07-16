import React, { useState } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Avatar,
  Chip,
  IconButton,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  MoreVert,
  CalendarToday,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import type { MonthSchedule, WeekSchedule, ViewMode } from '../../../../services/workSchedule.service';

interface ScheduleCalendarProps {
  schedule: MonthSchedule | WeekSchedule;
  viewMode: ViewMode;
  currentDate: Date;
  onScheduleUpdate: () => void;
}

const ScheduleCalendar: React.FC<ScheduleCalendarProps> = ({
  schedule,
  viewMode,
  currentDate,
  onScheduleUpdate,
}) => {
  const theme = useTheme();
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 5 || day === 6; // Friday or Saturday
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const formatTime = (time: string) => {
    return time; // Already in HH:MM format
  };

  const renderScheduleBlock = (employeeId: string, dayIndex: number) => {
    const daySchedule = schedule.days[dayIndex];
    if (!daySchedule) return null;

    const employeeSchedule = daySchedule.employees.find(e => e.employeeId === employeeId);
    
    if (!employeeSchedule) {
      return (
        <TableCell 
          key={dayIndex} 
          sx={{ 
            p: 1, 
            cursor: 'pointer',
            '&:hover': { backgroundColor: theme.palette.action.hover },
          }}
          onClick={() => {
            // TODO: Open schedule editor
            console.log('Add schedule for employee', employeeId, 'on day', dayIndex);
          }}
        />
      );
    }

    return (
      <TableCell 
        key={dayIndex} 
        sx={{ p: 1 }}
        onMouseEnter={() => setHoveredCell(`${employeeId}-${dayIndex}`)}
        onMouseLeave={() => setHoveredCell(null)}
      >
        <Box
          sx={{
            backgroundColor: '#4CAF50',
            color: 'white',
            borderRadius: 1,
            p: 1,
            minHeight: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s',
            '&:hover': {
              backgroundColor: '#45a049',
              transform: 'scale(1.02)',
            },
          }}
          onClick={() => {
            // TODO: Open schedule editor
            console.log('Edit schedule for employee', employeeId, 'on day', dayIndex);
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 500 }}>
            {formatTime(employeeSchedule.startTime)}-{formatTime(employeeSchedule.endTime)}
          </Typography>
        </Box>
        {hoveredCell === `${employeeId}-${dayIndex}` && (
          <Typography variant="caption" sx={{ display: 'block', mt: 0.5, textAlign: 'center' }}>
            {employeeSchedule.totalHours} ساعة
          </Typography>
        )}
      </TableCell>
    );
  };

  const renderDayHeaders = () => {
    const headers = [];
    
    // Month total header
    if (viewMode === 'month') {
      const monthSchedule = schedule as MonthSchedule;
      headers.push(
        <TableCell key="month-total" sx={{ fontWeight: 600, minWidth: 100 }}>
          مجموع {monthSchedule.month + 1}/{monthSchedule.year}
        </TableCell>
      );
    }

    // Day headers
    schedule.days.forEach((day, index) => {
      const date = new Date(day.date);
      const dayName = date.toLocaleDateString('ar-EG', { weekday: 'short' });
      const dayNumber = date.getDate();
      const isWeekendDay = isWeekend(date);
      const isTodayDate = isToday(date);

      headers.push(
        <TableCell 
          key={index} 
          align="center" 
          sx={{ 
            backgroundColor: isTodayDate ? theme.palette.warning.light : 'transparent',
            minWidth: 80,
          }}
        >
          <Typography variant="caption" sx={{ display: 'block' }}>
            {dayNumber}
          </Typography>
          <Typography 
            variant="caption" 
            sx={{ 
              display: 'block',
              color: isWeekendDay ? 'error.main' : 'text.secondary',
              fontWeight: isTodayDate ? 600 : 400,
            }}
          >
            {dayName}
          </Typography>
        </TableCell>
      );
    });

    return headers;
  };

  return (
    <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
      <Table stickyHeader>
        <TableHead>
          <TableRow>
            {/* Staff header */}
            <TableCell sx={{ backgroundColor: theme.palette.background.paper, minWidth: 200 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  الموظفين
                </Typography>
                <Chip 
                  label={Object.keys(schedule.employeeTotals).length} 
                  size="small" 
                  color="warning"
                  sx={{ height: 20 }}
                />
              </Box>
            </TableCell>
            {renderDayHeaders()}
          </TableRow>
        </TableHead>
        <TableBody>
          {Object.entries(schedule.employeeTotals).map(([employeeId, employeeData], index) => (
            <motion.tr
              key={employeeId}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              {/* Employee info cell */}
              <TableCell sx={{ backgroundColor: theme.palette.background.default }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ width: 32, height: 32 }}>
                      {employeeData.name.charAt(0)}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {employeeData.name}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                        <CalendarToday sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary">
                          {employeeData.scheduledDays}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ({employeeData.totalHours} س.)
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                  <IconButton size="small">
                    <MoreVert fontSize="small" />
                  </IconButton>
                </Box>
              </TableCell>

              {/* Schedule cells */}
              {schedule.days.map((_, dayIndex) => renderScheduleBlock(employeeId, dayIndex))}
            </motion.tr>
          ))}
          
          {/* Total row */}
          <TableRow sx={{ backgroundColor: theme.palette.action.hover }}>
            <TableCell sx={{ fontWeight: 600 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2">المجموع</Typography>
                <Typography variant="body2">{schedule.totalHours} ساعة</Typography>
              </Box>
            </TableCell>
            {schedule.days.map((day, index) => {
              const dayTotal = day.employees.reduce((sum, emp) => sum + emp.totalHours, 0);
              return (
                <TableCell key={index} align="center">
                  {dayTotal > 0 && (
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      {dayTotal}
                    </Typography>
                  )}
                </TableCell>
              );
            })}
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default ScheduleCalendar;