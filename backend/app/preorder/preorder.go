// Package preorder powers restaurant takeaway/delivery pre-orders. A guest
// picks pre-order items the restaurant has published, chooses Collection or
// Delivery (only the options the restaurant supports) plus a preferred time,
// and the order is emailed to the restaurant (bookings email, else official
// email). No money moves and nothing is stored — it mirrors the "email the
// partner" behaviour of the booking flow.
package preorder

import (
	"context"
	"fmt"
	"strings"

	"backend_encore/internal/appdb"
	"backend_encore/internal/errs"
	"backend_encore/internal/mailer"
	"backend_encore/store"
)

var restaurants = store.NewRestaurantStore()
var bookings = store.NewBookingStore()

// preOrderCommissionRate is the platform's cut of every restaurant pre-order.
const preOrderCommissionRate = 0.05

type SubmitItem struct {
	Name     string `json:"name"`
	Quantity int    `json:"quantity"`
}

type SubmitRequest struct {
	RestaurantID    int64        `json:"restaurantId"`
	CustomerName    string       `json:"customerName"`
	CustomerEmail   string       `json:"customerEmail"`
	CustomerPhone   string       `json:"customerPhone"`
	Fulfilment      string       `json:"fulfilment"` // "Collection" | "Delivery"
	DeliveryAddress string       `json:"deliveryAddress,omitempty"`
	PreferredDate   string       `json:"preferredDate"`
	PreferredTime   string       `json:"preferredTime,omitempty"`
	Items           []SubmitItem `json:"items"`
	Notes           string       `json:"notes,omitempty"`
}

type SubmitResponse struct {
	OK    bool    `json:"ok"`
	Total float64 `json:"total"`
}

//encore:api auth method=POST path=/preorder
func Submit(ctx context.Context, req *SubmitRequest) (*SubmitResponse, error) {
	if strings.TrimSpace(req.CustomerName) == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "your name is required"}
	}
	if strings.TrimSpace(req.CustomerEmail) == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "your email is required"}
	}
	if strings.TrimSpace(req.PreferredDate) == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "a preferred date is required"}
	}
	if len(req.Items) == 0 {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "select at least one item"}
	}

	r, err := restaurants.Get(ctx, req.RestaurantID)
	if err != nil {
		return nil, &errs.Error{Code: errs.NotFound, Message: "restaurant not found"}
	}

	// Fulfilment must be one the restaurant actually offers.
	fulfil := strings.TrimSpace(req.Fulfilment)
	switch fulfil {
	case "Collection":
		if !r.ServiceTakeaway {
			return nil, &errs.Error{Code: errs.InvalidArgument, Message: "this restaurant does not offer collection"}
		}
	case "Delivery":
		if !r.ServiceDelivery {
			return nil, &errs.Error{Code: errs.InvalidArgument, Message: "this restaurant does not offer delivery"}
		}
		if strings.TrimSpace(req.DeliveryAddress) == "" {
			return nil, &errs.Error{Code: errs.InvalidArgument, Message: "a delivery address is required"}
		}
	default:
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "choose collection or delivery"}
	}

	// Price + lead time from the restaurant's authoritative pre-order list.
	byName := map[string]appdb.PreOrderItem{}
	for _, it := range r.PreOrderItems {
		byName[strings.ToLower(strings.TrimSpace(it.Name))] = it
	}
	type line struct {
		item appdb.PreOrderItem
		qty  int
	}
	var lines []line
	var total float64
	maxLead := 0
	for _, sel := range req.Items {
		qty := sel.Quantity
		if qty <= 0 {
			qty = 1
		}
		if pi, ok := byName[strings.ToLower(strings.TrimSpace(sel.Name))]; ok {
			lines = append(lines, line{item: pi, qty: qty})
			total += pi.Price * float64(qty)
			if pi.LeadTimeMinutes > maxLead {
				maxLead = pi.LeadTimeMinutes
			}
		}
	}
	if len(lines) == 0 {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "the selected items are not offered by this restaurant"}
	}

	// Store the pre-order as a bookings row so it flows into monthly billing
	// (RunMonthlyBilling sums bookings.commission for booking-plan partners),
	// the accountant ledger, and rep commission — exactly like a table booking,
	// but distinguished by party_size = 0 and a 5%-of-total commission.
	commission := total * preOrderCommissionRate
	orderItems := appdb.BookingItems{}
	for _, l := range lines {
		orderItems = append(orderItems, appdb.BookingItem{
			Name:  fmt.Sprintf("%d × %s", l.qty, l.item.Name),
			Price: l.item.Price * float64(l.qty),
		})
	}
	if _, err := bookings.Create(ctx, &appdb.Booking{
		EntityType:    "restaurant",
		EntityID:      r.ID,
		EntityName:    r.Name,
		CustomerName:  strings.TrimSpace(req.CustomerName),
		CustomerEmail: strings.TrimSpace(req.CustomerEmail),
		CustomerPhone: strings.TrimSpace(req.CustomerPhone),
		BookingDate:   strings.TrimSpace(req.PreferredDate),
		BookingTime:   strings.TrimSpace(req.PreferredTime),
		Items:         orderItems,
		Total:         total,
		Commission:    commission,
		PartySize:     0, // 0 marks this as a pre-order, not a table booking
		Status:        "pending",
	}); err != nil {
		return nil, &errs.Error{Code: errs.Internal, Message: "could not record the pre-order"}
	}

	recipient := strings.TrimSpace(r.BookingsEmail)
	if recipient == "" {
		recipient = strings.TrimSpace(r.OfficialEmail)
	}

	// Build the order email.
	var b strings.Builder
	b.WriteString(fmt.Sprintf(`<h2>New pre-order on Around You</h2><p>You have a new pre-order for <strong>%s</strong>.</p><ul>`, r.Name))
	for _, l := range lines {
		lead := ""
		if l.item.LeadTimeMinutes > 0 {
			lead = fmt.Sprintf(" — ready in ~%d min", l.item.LeadTimeMinutes)
		}
		b.WriteString(fmt.Sprintf(`<li>%d × %s — R %.2f%s</li>`, l.qty, l.item.Name, l.item.Price*float64(l.qty), lead))
	}
	b.WriteString(`</ul>`)
	b.WriteString(fmt.Sprintf(`<p><strong>Total:</strong> R %.2f</p>`, total))
	b.WriteString(fmt.Sprintf(`<p><strong>%s</strong>`, fulfil))
	if fulfil == "Delivery" {
		b.WriteString(fmt.Sprintf(` to: %s`, req.DeliveryAddress))
	}
	when := req.PreferredDate
	if strings.TrimSpace(req.PreferredTime) != "" {
		when += " at " + req.PreferredTime
	}
	b.WriteString(fmt.Sprintf(` &nbsp;·&nbsp; Preferred: %s</p>`, when))
	if maxLead > 0 {
		b.WriteString(fmt.Sprintf(`<p style="color:#666;font-size:13px">Longest item lead time is about %d minutes — please confirm you can meet the preferred time.</p>`, maxLead))
	}
	contact := strings.TrimSpace(req.CustomerName)
	extras := []string{}
	if strings.TrimSpace(req.CustomerPhone) != "" {
		extras = append(extras, req.CustomerPhone)
	}
	if strings.TrimSpace(req.CustomerEmail) != "" {
		extras = append(extras, req.CustomerEmail)
	}
	if len(extras) > 0 {
		contact += " (" + strings.Join(extras, ", ") + ")"
	}
	b.WriteString(fmt.Sprintf(`<p><strong>Customer:</strong> %s</p>`, contact))
	if strings.TrimSpace(req.Notes) != "" {
		b.WriteString(fmt.Sprintf(`<p><strong>Notes:</strong> %s</p>`, req.Notes))
	}
	b.WriteString(`<p style="color:#888;font-size:12px">Contact the customer to confirm and arrange payment.</p>`)

	if recipient != "" {
		go func(to, html string) { _ = mailer.Send(to, "New pre-order on Around You — "+r.Name, html) }(recipient, b.String())
	}

	return &SubmitResponse{OK: true, Total: total}, nil
}
