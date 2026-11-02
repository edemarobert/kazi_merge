export type DemoCompany = {
  id: string;
  name: string;
  industry: string;
  sizeBand: string;
  owner: {
    id: string;
    email: string;
    name: string;
    membershipId: string;
    employeeId: string;
  };
  employee: {
    id: string;
    email: string;
    name: string;
    membershipId: string;
    employeeId: string;
  };
  department: {
    id: string;
    name: string;
  };
  team: {
    id: string;
    name: string;
  };
  task: {
    id: string;
    title: string;
  };
};

export const demoCompanies: readonly DemoCompany[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Kampala Goods",
    industry: "Retail",
    sizeBand: "10-50",
    owner: {
      id: "00000000-0000-4000-8000-000000000011",
      email: "owner@kampala-goods.example",
      name: "Amina Nakato",
      membershipId: "00000000-0000-4000-8000-000000000021",
      employeeId: "00000000-0000-4000-8000-000000000031",
    },
    employee: {
      id: "00000000-0000-4000-8000-000000000012",
      email: "employee@kampala-goods.example",
      name: "Brian Kato",
      membershipId: "00000000-0000-4000-8000-000000000022",
      employeeId: "00000000-0000-4000-8000-000000000032",
    },
    department: {
      id: "00000000-0000-4000-8000-000000000041",
      name: "Operations",
    },
    team: {
      id: "00000000-0000-4000-8000-000000000051",
      name: "Store Operations",
    },
    task: {
      id: "00000000-0000-4000-8000-000000000061",
      title: "Check weekly stock levels",
    },
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    name: "Entebbe Services",
    industry: "Professional services",
    sizeBand: "10-50",
    owner: {
      id: "00000000-0000-4000-8000-000000000013",
      email: "owner@entebbe-services.example",
      name: "David Ochieng",
      membershipId: "00000000-0000-4000-8000-000000000023",
      employeeId: "00000000-0000-4000-8000-000000000033",
    },
    employee: {
      id: "00000000-0000-4000-8000-000000000014",
      email: "employee@entebbe-services.example",
      name: "Grace Atim",
      membershipId: "00000000-0000-4000-8000-000000000024",
      employeeId: "00000000-0000-4000-8000-000000000034",
    },
    department: {
      id: "00000000-0000-4000-8000-000000000042",
      name: "Client Services",
    },
    team: {
      id: "00000000-0000-4000-8000-000000000052",
      name: "Client Delivery",
    },
    task: {
      id: "00000000-0000-4000-8000-000000000062",
      title: "Prepare client follow-up",
    },
  },
];
