package billing

import (
	"context"

	"backend_encore/internal/appdb"
)

// InvoiceSettings brands invoices: business details, bank details, payment
// terms, and a logo. A single row (id = 1).
type InvoiceSettings struct {
	BusinessName     string `json:"businessName"`
	Address          string `json:"address"`
	ContactEmail     string `json:"contactEmail"`
	ContactPhone     string `json:"contactPhone"`
	RegNumber        string `json:"regNumber"`
	VatNumber        string `json:"vatNumber"`
	BankName         string `json:"bankName"`
	AccountName      string `json:"accountName"`
	AccountNumber    string `json:"accountNumber"`
	BranchCode       string `json:"branchCode"`
	PaymentReference string `json:"paymentReference"`
	PaymentTerms     string `json:"paymentTerms"`
	LogoURL          string `json:"logoUrl"`
}

// LoadInvoiceSettings returns the current settings row (defaults if unset).
func LoadInvoiceSettings(ctx context.Context) (*InvoiceSettings, error) {
	s := &InvoiceSettings{}
	err := appdb.SQLDB.QueryRowContext(ctx, `
		SELECT business_name, address, contact_email, contact_phone, reg_number, vat_number,
		       bank_name, account_name, account_number, branch_code, payment_reference, payment_terms, logo_url
		FROM invoice_settings WHERE id = 1`).Scan(
		&s.BusinessName, &s.Address, &s.ContactEmail, &s.ContactPhone, &s.RegNumber, &s.VatNumber,
		&s.BankName, &s.AccountName, &s.AccountNumber, &s.BranchCode, &s.PaymentReference, &s.PaymentTerms, &s.LogoURL,
	)
	if err != nil {
		return nil, err
	}
	return s, nil
}

// SaveInvoiceSettings updates the single settings row.
func SaveInvoiceSettings(ctx context.Context, s *InvoiceSettings) error {
	_, err := appdb.SQLDB.ExecContext(ctx, `
		UPDATE invoice_settings SET
		  business_name = $1, address = $2, contact_email = $3, contact_phone = $4,
		  reg_number = $5, vat_number = $6, bank_name = $7, account_name = $8,
		  account_number = $9, branch_code = $10, payment_reference = $11,
		  payment_terms = $12, logo_url = $13, updated_at = now()
		WHERE id = 1`,
		s.BusinessName, s.Address, s.ContactEmail, s.ContactPhone, s.RegNumber, s.VatNumber,
		s.BankName, s.AccountName, s.AccountNumber, s.BranchCode, s.PaymentReference, s.PaymentTerms, s.LogoURL,
	)
	return err
}
