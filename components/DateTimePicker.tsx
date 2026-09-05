import React from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { vi } from 'date-fns/locale';
import { format, parseISO, parse } from 'date-fns';

registerLocale('vi', vi);

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const DateTimePicker: React.FC<DateTimePickerProps> = ({ value, onChange, className }) => {
  const selectedDate = value ? parseISO(value) : null;

  const handleChange = (date: Date | null) => {
    if (date) {
      // Format to YYYY-MM-DDTHH:mm
      const formatted = format(date, "yyyy-MM-dd'T'HH:mm");
      onChange(formatted);
    } else {
      onChange('');
    }
  };

  return (
    <DatePicker
      selected={selectedDate}
      onChange={handleChange}
      showTimeSelect
      timeFormat="HH:mm"
      timeIntervals={15}
      timeCaption="Giờ"
      dateFormat="dd/MM/yyyy HH:mm"
      locale="vi"
      className={className}
      portalId="portal-datepicker"
      popperClassName="z-[9999]"
    />
  );
};

interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const TimePicker: React.FC<TimePickerProps> = ({ value, onChange, className }) => {
  const selectedTime = value ? parse(value, 'HH:mm', new Date()) : null;

  const handleChange = (date: Date | null) => {
    if (date) {
      const formatted = format(date, "HH:mm");
      onChange(formatted);
    } else {
      onChange('');
    }
  };

  return (
    <DatePicker
      selected={selectedTime}
      onChange={handleChange}
      showTimeSelect
      showTimeSelectOnly
      timeIntervals={1}
      timeCaption="Giờ"
      dateFormat="HH:mm"
      timeFormat="HH:mm"
      locale="vi"
      className={className}
      portalId="portal-datepicker"
      popperClassName="z-[9999]"
    />
  );
};
