"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PAYMENT_ORDERS_SCRIPT_CONFIG = exports.UNPAID_INVOICE_SCRIPT_CONFIG = exports.REGENERATE_INVOICE_SCRIPT_CONFIG = exports.INVOICE_SCRIPT_CONFIG = void 0;
exports.INVOICE_SCRIPT_CONFIG = {
    branches: {
        24925: {
            loginPageUrl: "https://app.edlingo.com/",
            branchLoginSelectorId: "Demo Branch",
            invoicesPageUrl: "https://app.edlingo.com/accounting/invoices/staging/",
            filters: {
                minAmount: 0,
                maxAmount: 700,
                adhocAmounts: [],
            },
        },
        24924: {
            loginPageUrl: "https://app.edlingo.com/",
            branchLoginSelectorId: "Edlingo",
            invoicesPageUrl: "https://app.edlingo.com/accounting/invoices/staging/",
            filters: {
                minAmount: 0,
                maxAmount: 700,
                adhocAmounts: [],
            },
        },
        23991: {
            loginPageUrl: "https://app.sosprof.com/",
            branchLoginSelectorId: "SOSprof",
            invoicesPageUrl: "https://app.sosprof.com/accounting/invoices/staging/",
            filters: {
                minAmount: 0,
                maxAmount: 700,
                adhocAmounts: ["34.49"],
            },
        },
        23992: {
            loginPageUrl: "https://app.sosprof.com/",
            branchLoginSelectorId: "Demo Branch",
            invoicesPageUrl: "https://app.sosprof.com/accounting/invoices/staging/",
            filters: {
                minAmount: 0,
                maxAmount: 700,
                adhocAmounts: ["34.49"],
            },
        },
        3269: {
            loginPageUrl: "https://app.tutorax.com/",
            branchLoginSelectorId: "Tutorax Administration",
            invoicesPageUrl: "https://app.tutorax.com/accounting/invoices/staging/",
            filters: {
                minAmount: 0,
                maxAmount: 700,
                adhocAmounts: ["34.49"],
            },
        },
        3268: {
            loginPageUrl: "https://app.tutorax.com/",
            branchLoginSelectorId: "Tutorax - Tutorat",
            invoicesPageUrl: "https://app.tutorax.com/accounting/invoices/staging/",
            filters: {
                minAmount: 0,
                maxAmount: 700,
                adhocAmounts: ["34.49"],
            },
        },
        7673: {
            loginPageUrl: "https://app.tutorax.com/",
            branchLoginSelectorId: "Tutorax - Canada",
            invoicesPageUrl: "https://app.tutorax.com/accounting/invoices/staging/",
            filters: {
                minAmount: 0,
                maxAmount: 700,
                adhocAmounts: ["28.25", "25.00", "26.25"],
            },
        },
        5737: {
            loginPageUrl: "https://app.tutorax.com/",
            branchLoginSelectorId: "Tutorax - Stimulation du langage",
            invoicesPageUrl: "https://app.tutorax.com/accounting/invoices/staging/",
            filters: {
                minAmount: 0,
                maxAmount: 700,
                adhocAmounts: ["40.24"],
            },
        },
        8427: {
            loginPageUrl: "https://app.tutorax.com/",
            branchLoginSelectorId: "Tutorax - Orthopédagogie",
            invoicesPageUrl: "https://app.tutorax.com/accounting/invoices/staging/",
            filters: {
                minAmount: 0,
                maxAmount: 700,
                adhocAmounts: ["40.24"],
            },
        },
        15751: {
            loginPageUrl: "https://app.tutorax.com/",
            branchLoginSelectorId: "Tutorax - USA",
            invoicesPageUrl: "https://app.tutorax.com/accounting/invoices/staging/",
            filters: {
                minAmount: 0,
                maxAmount: 700,
                adhocAmounts: ["20.00"],
            },
        },
        14409: {
            loginPageUrl: "https://app.tutorax.com/",
            branchLoginSelectorId: "Tutorax - Orthophonie",
            invoicesPageUrl: "https://app.tutorax.com/accounting/invoices/staging/",
            filters: {
                minAmount: 0,
                maxAmount: 700,
                adhocAmounts: [],
            },
        },
    },
};
exports.REGENERATE_INVOICE_SCRIPT_CONFIG = {
    branches: {
        24925: {
            loginPageUrl: "https://app.edlingo.com/",
            branchLoginSelectorId: "Demo Branch",
            invoicesPageUrl: "https://app.edlingo.com/accounting/invoices/staging/",
            filters: {
                maxAmount: 700,
            },
        },
        24924: {
            loginPageUrl: "https://app.edlingo.com/",
            branchLoginSelectorId: "Edlingo",
            invoicesPageUrl: "https://app.edlingo.com/accounting/invoices/staging/",
            filters: {
                maxAmount: 700,
            },
        },
        23991: {
            loginPageUrl: "https://app.sosprof.com/",
            branchLoginSelectorId: "SOSprof",
            invoicesPageUrl: "https://app.sosprof.com/accounting/invoices/staging/",
            filters: {
                maxAmount: 700,
            },
        },
        23992: {
            loginPageUrl: "https://app.sosprof.com/",
            branchLoginSelectorId: "Demo Branch",
            invoicesPageUrl: "https://app.sosprof.com/accounting/invoices/staging/",
            filters: {
                maxAmount: 700,
            },
        },
        3269: {
            loginPageUrl: "https://app.tutorax.com/",
            branchLoginSelectorId: "Tutorax Administration",
            invoicesPageUrl: "https://app.tutorax.com/accounting/invoices/staging/",
            filters: {
                maxAmount: 700,
            },
        },
        3268: {
            loginPageUrl: "https://app.tutorax.com/",
            branchLoginSelectorId: "Tutorax - Tutorat",
            invoicesPageUrl: "https://app.tutorax.com/accounting/invoices/staging/",
            filters: {
                maxAmount: 700,
            },
        },
        7673: {
            loginPageUrl: "https://app.tutorax.com/",
            branchLoginSelectorId: "Tutorax - Canada",
            invoicesPageUrl: "https://app.tutorax.com/accounting/invoices/staging/",
            filters: {
                maxAmount: 700,
            },
        },
        5737: {
            loginPageUrl: "https://app.tutorax.com/",
            branchLoginSelectorId: "Tutorax - Stimulation du langage",
            invoicesPageUrl: "https://app.tutorax.com/accounting/invoices/staging/",
            filters: {
                maxAmount: 700,
            },
        },
        8427: {
            loginPageUrl: "https://app.tutorax.com/",
            branchLoginSelectorId: "Tutorax - Orthopédagogie",
            invoicesPageUrl: "https://app.tutorax.com/accounting/invoices/staging/",
            filters: {
                maxAmount: 700,
            },
        },
        15751: {
            loginPageUrl: "https://app.tutorax.com/",
            branchLoginSelectorId: "Tutorax - USA",
            invoicesPageUrl: "https://app.tutorax.com/accounting/invoices/staging/",
            filters: {
                maxAmount: 700,
            },
        },
        14409: {
            loginPageUrl: "https://app.tutorax.com/",
            branchLoginSelectorId: "Tutorax - Orthophonie",
            invoicesPageUrl: "https://app.tutorax.com/accounting/invoices/staging/",
            filters: {
                maxAmount: 700,
            },
        },
    },
};
exports.UNPAID_INVOICE_SCRIPT_CONFIG = {
    branches: {
        24925: {
            loginPageUrl: "https://app.edlingo.com/",
            branchLoginSelectorId: "Edlingo",
            unpaidInvoicesUrl: "https://app.edlingo.com/accounting/invoices/raised/?tab=unpaid",
        },
        24924: {
            loginPageUrl: "https://app.edlingo.com/",
            branchLoginSelectorId: "Edlingo",
            unpaidInvoicesUrl: "https://app.edlingo.com/accounting/invoices/raised/?tab=unpaid",
        },
        23991: {
            loginPageUrl: "https://app.sosprof.com/",
            branchLoginSelectorId: "SOSprof",
            unpaidInvoicesUrl: "https://app.sosprof.com/accounting/invoices/raised/?tab=unpaid",
        },
        23992: {
            loginPageUrl: "https://app.sosprof.com/",
            branchLoginSelectorId: "Demo Branch",
            unpaidInvoicesUrl: "https://app.sosprof.com/accounting/invoices/raised/?tab=unpaid",
        },
        3269: {
            loginPageUrl: "https://app.tutorax.com/",
            branchLoginSelectorId: "Tutorax Administration",
            unpaidInvoicesUrl: "https://app.tutorax.com/accounting/invoices/raised/?tab=unpaid",
        },
        3268: {
            loginPageUrl: "https://app.tutorax.com/",
            branchLoginSelectorId: "Tutorax - Tutorat",
            unpaidInvoicesUrl: "https://app.tutorax.com/accounting/invoices/raised/?tab=unpaid",
        },
        7673: {
            loginPageUrl: "https://app.tutorax.com/",
            branchLoginSelectorId: "Tutorax - Canada",
            unpaidInvoicesUrl: "https://app.tutorax.com/accounting/invoices/raised/?tab=unpaid",
        },
        5737: {
            loginPageUrl: "https://app.tutorax.com/",
            branchLoginSelectorId: "Tutorax - Stimulation du langage",
            unpaidInvoicesUrl: "https://app.tutorax.com/accounting/invoices/raised/?tab=unpaid",
        },
        8427: {
            loginPageUrl: "https://app.tutorax.com/",
            branchLoginSelectorId: "Tutorax - Orthopédagogie",
            unpaidInvoicesUrl: "https://app.tutorax.com/accounting/invoices/raised/?tab=unpaid",
        },
        15751: {
            loginPageUrl: "https://app.tutorax.com/",
            branchLoginSelectorId: "Tutorax - USA",
            unpaidInvoicesUrl: "https://app.tutorax.com/accounting/invoices/raised/?tab=unpaid",
        },
        14409: {
            loginPageUrl: "https://app.tutorax.com/",
            branchLoginSelectorId: "Tutorax - Orthophonie",
            unpaidInvoicesUrl: "https://app.tutorax.com/accounting/invoices/raised/?tab=unpaid",
        },
    },
};
exports.PAYMENT_ORDERS_SCRIPT_CONFIG = {
    branches: {
        24925: {
            loginPageUrl: "https://app.edlingo.com/",
            branchLoginSelectorId: "Demo Branch",
            posPageUrl: "https://app.edlingo.com/accounting/pos/staging/",
            minAmount: 0,
        },
        24924: {
            loginPageUrl: "https://app.edlingo.com/",
            branchLoginSelectorId: "Edlingo",
            posPageUrl: "https://app.edlingo.com/accounting/pos/staging/",
            minAmount: 0,
        },
        23991: {
            loginPageUrl: "https://app.sosprof.com/",
            branchLoginSelectorId: "SOSprof",
            posPageUrl: "https://app.sosprof.com/accounting/pos/staging/",
            minAmount: 0,
        },
        23992: {
            loginPageUrl: "https://app.sosprof.com/",
            branchLoginSelectorId: "Demo Branch",
            posPageUrl: "https://app.sosprof.com/accounting/pos/staging/",
            minAmount: 0,
        },
        3269: {
            loginPageUrl: "https://app.tutorax.com/",
            branchLoginSelectorId: "Tutorax Administration",
            posPageUrl: "https://app.tutorax.com/accounting/pos/staging/",
            minAmount: 0,
        },
        3268: {
            loginPageUrl: "https://app.tutorax.com/",
            branchLoginSelectorId: "Tutorax - Tutorat",
            posPageUrl: "https://app.tutorax.com/accounting/pos/staging/",
            minAmount: 50,
        },
        7673: {
            loginPageUrl: "https://app.tutorax.com/",
            branchLoginSelectorId: "Tutorax - Canada",
            posPageUrl: "https://app.tutorax.com/accounting/pos/staging/",
            minAmount: 50,
        },
        5737: {
            loginPageUrl: "https://app.tutorax.com/",
            branchLoginSelectorId: "Tutorax - Stimulation du langage",
            posPageUrl: "https://app.tutorax.com/accounting/pos/staging/",
            minAmount: 50,
        },
        8427: {
            loginPageUrl: "https://app.tutorax.com/",
            branchLoginSelectorId: "Tutorax - Orthopédagogie",
            posPageUrl: "https://app.tutorax.com/accounting/pos/staging/",
            minAmount: 50,
        },
        15751: {
            loginPageUrl: "https://app.tutorax.com/",
            branchLoginSelectorId: "Tutorax - USA",
            posPageUrl: "https://app.tutorax.com/accounting/pos/staging/",
            minAmount: 50,
        },
    },
};
