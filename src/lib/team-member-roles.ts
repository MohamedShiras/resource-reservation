export const TEAM_MEMBER_ROLE_OPTIONS = [
  { value: "business_analyst", label: "Business Analyst" },
  { value: "ui_ux_designer", label: "UI/UX Designer" },
  { value: "software_architect", label: "Software Architect" },
  { value: "engineering_manager", label: "Engineering Manager / Tech Lead" },
  { value: "software_engineer", label: "Software Developer / Engineer" },
  { value: "qa_tester", label: "Quality Assurance (QA) / Tester" },
  { value: "devops_engineer", label: "DevOps Engineer" },
] as const;

export type TeamMemberRole = (typeof TEAM_MEMBER_ROLE_OPTIONS)[number]["value"];

export const TEAM_MEMBER_ROLE_VALUES = TEAM_MEMBER_ROLE_OPTIONS.map((role) => role.value) as [
  TeamMemberRole,
  ...TeamMemberRole[],
];

export function getTeamMemberRoleLabel(value: string) {
  return TEAM_MEMBER_ROLE_OPTIONS.find((role) => role.value === value)?.label ?? value;
}
