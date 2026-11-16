export const reminderAudiences = ['personal','family','both'] as const;
export type ReminderAudience = typeof reminderAudiences[number];
export const reminderAudienceLabels: Record<ReminderAudience,string> = {
 personal:'Pessoal',family:'Em família',both:'Os dois'
};
