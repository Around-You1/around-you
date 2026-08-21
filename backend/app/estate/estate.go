// Package estate implements the Real Estate & Rentals API: agencies, agents and
// property listings. Writes are restricted to internal roles (SuperAdmin /
// Admin / Rep); public reads return sanitized data for guests/locals.
//
// Billing: creating an agency page or an agent page bills a flat R300/month via
// the shared billing pipeline (partner_type 'estate_agency' / 'estate_agent').
// Properties are not billed. See REAL_ESTATE_RENTALS_SPEC.md.
package estate

import (
	"context"
	"strings"

	"backend_encore/app/auth"
	"backend_encore/internal/appdb"
	"backend_encore/internal/billing"
	"backend_encore/internal/dedupe"
	"backend_encore/internal/errs"
	"backend_encore/internal/moderation"
	"backend_encore/store"
)

var (
	agencies   = store.NewEstateAgencyStore()
	agents     = store.NewEstateAgentStore()
	properties = store.NewEstatePropertyStore()
)

func requirePrivileged(ctx context.Context) error {
	if !auth.IsPrivileged(ctx) {
		return &errs.Error{Code: errs.PermissionDenied, Message: "not allowed"}
	}
	return nil
}

// ---- small request/response shapes ----

type idReq struct {
	ID int64 `json:"id" query:"id"`
}
type codeReq struct {
	Code string `json:"code" query:"code"`
}
type agencyIDReq struct {
	AgencyID int64 `json:"agencyId" query:"agencyId"`
}
type activeReq struct {
	ID     int64 `json:"id"`
	Active bool  `json:"active"`
}
type okResp struct {
	OK bool `json:"ok"`
}

type AgenciesResponse struct {
	Agencies []appdb.EstateAgency `json:"agencies"`
}
type AgentsResponse struct {
	Agents []appdb.EstateAgent `json:"agents"`
}
type PropertiesResponse struct {
	Properties []appdb.EstateProperty `json:"properties"`
}

// ================= Agencies =================

//encore:api auth method=POST path=/estate/agency
func CreateAgency(ctx context.Context, req *appdb.EstateAgency) (*appdb.EstateAgency, error) {
	if err := requirePrivileged(ctx); err != nil {
		return nil, err
	}
	if strings.TrimSpace(req.Name) == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "agency name is required"}
	}
	if err := moderation.BlockError(
		moderation.NamedField{Name: "name", Value: req.Name},
		moderation.NamedField{Name: "description", Value: req.Description},
	); err != nil {
		return nil, err
	}
	created, err := agencies.Create(ctx, req)
	if err != nil {
		return nil, err
	}
	// Flat R300/mo for the agency page (best-effort; never blocks onboarding).
	_ = billing.OnPartnerOnboarded(ctx, "estate_agency", created.ID, "", "", created.OfficialRepCode)
	moderation.ScanAndFlag(ctx, "partner_profile", "estate_agency", created.ID, created.Name, auth.ActorLabel(ctx),
		moderation.NamedField{Name: "name", Value: created.Name},
		moderation.NamedField{Name: "description", Value: created.Description},
	)
	dedupe.CheckOnCreate(ctx, "estate_agencies", "contact_number", "estate_agency", created.ID,
		created.Name, created.ContactNumber, created.Address, created.OfficialRepCode, auth.ActorLabel(ctx))
	return created, nil
}

//encore:api auth method=PUT path=/estate/agency
func UpdateAgency(ctx context.Context, req *appdb.EstateAgency) (*appdb.EstateAgency, error) {
	if err := requirePrivileged(ctx); err != nil {
		return nil, err
	}
	if err := moderation.BlockError(
		moderation.NamedField{Name: "name", Value: req.Name},
		moderation.NamedField{Name: "description", Value: req.Description},
	); err != nil {
		return nil, err
	}
	updated, err := agencies.Update(ctx, req.ID, req)
	if err != nil {
		return nil, mapNotFound(err)
	}
	// Keep the subscription's rep attribution in sync.
	_ = billing.OnPartnerOnboarded(ctx, "estate_agency", updated.ID, "", "", updated.OfficialRepCode)
	moderation.ScanAndFlag(ctx, "partner_profile", "estate_agency", updated.ID, updated.Name, auth.ActorLabel(ctx),
		moderation.NamedField{Name: "name", Value: updated.Name},
		moderation.NamedField{Name: "description", Value: updated.Description},
	)
	return updated, nil
}

//encore:api auth method=GET path=/estate/agencies
func ListAgencies(ctx context.Context) (*AgenciesResponse, error) {
	if err := requirePrivileged(ctx); err != nil {
		return nil, err
	}
	list, err := agencies.List(ctx, false)
	if err != nil {
		return nil, err
	}
	return &AgenciesResponse{Agencies: list}, nil
}

//encore:api auth method=GET path=/estate/agency/get
func GetAgency(ctx context.Context, req *idReq) (*appdb.EstateAgency, error) {
	if err := requirePrivileged(ctx); err != nil {
		return nil, err
	}
	a, err := agencies.Get(ctx, req.ID)
	if err != nil {
		return nil, mapNotFound(err)
	}
	return a, nil
}

//encore:api auth method=POST path=/estate/agency/active
func SetAgencyActive(ctx context.Context, req *activeReq) (*okResp, error) {
	if err := requirePrivileged(ctx); err != nil {
		return nil, err
	}
	if err := agencies.SetActive(ctx, req.ID, req.Active); err != nil {
		return nil, err
	}
	if req.Active {
		_ = billing.OnPartnerOnboarded(ctx, "estate_agency", req.ID, "", "", "")
		_ = billing.SetStatusByPartner(ctx, "estate_agency", req.ID, "Active")
	} else {
		_ = billing.SetStatusByPartner(ctx, "estate_agency", req.ID, "Cancelled")
	}
	return &okResp{OK: true}, nil
}

//encore:api auth method=DELETE path=/estate/agency
func DeleteAgency(ctx context.Context, req *idReq) (*okResp, error) {
	if err := requirePrivileged(ctx); err != nil {
		return nil, err
	}
	// Cancel billing for the agency and each of its agent pages before the
	// cascade delete removes their rows.
	if ags, err := agents.ListByAgency(ctx, req.ID, false); err == nil {
		for _, ag := range ags {
			_ = billing.SetStatusByPartner(ctx, "estate_agent", ag.ID, "Cancelled")
		}
	}
	_ = billing.SetStatusByPartner(ctx, "estate_agency", req.ID, "Cancelled")
	if err := agencies.Delete(ctx, req.ID); err != nil {
		return nil, mapNotFound(err)
	}
	return &okResp{OK: true}, nil
}

// ================= Agents =================

//encore:api auth method=POST path=/estate/agent
func CreateAgent(ctx context.Context, req *appdb.EstateAgent) (*appdb.EstateAgent, error) {
	if err := requirePrivileged(ctx); err != nil {
		return nil, err
	}
	// Agents are now standalone, self-paying profiles: no agency link required.
	if strings.TrimSpace(req.Name) == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "agent name is required"}
	}
	if err := moderation.BlockError(
		moderation.NamedField{Name: "name", Value: req.Name},
		moderation.NamedField{Name: "bio", Value: req.Bio},
	); err != nil {
		return nil, err
	}
	created, err := agents.Create(ctx, req)
	if err != nil {
		return nil, err
	}
	// Each agent page is a flat R300/mo, attributed to the agent's own rep code
	// (falling back to blank -> the billing run still bills the page).
	_ = billing.OnPartnerOnboarded(ctx, "estate_agent", created.ID, "", "", created.OfficialRepCode)
	moderation.ScanAndFlag(ctx, "partner_profile", "estate_agent", created.ID, created.Name, auth.ActorLabel(ctx),
		moderation.NamedField{Name: "name", Value: created.Name},
		moderation.NamedField{Name: "bio", Value: created.Bio},
	)
	return created, nil
}

//encore:api auth method=PUT path=/estate/agent
func UpdateAgent(ctx context.Context, req *appdb.EstateAgent) (*appdb.EstateAgent, error) {
	if err := requirePrivileged(ctx); err != nil {
		return nil, err
	}
	if err := moderation.BlockError(
		moderation.NamedField{Name: "name", Value: req.Name},
		moderation.NamedField{Name: "bio", Value: req.Bio},
	); err != nil {
		return nil, err
	}
	updated, err := agents.Update(ctx, req.ID, req)
	if err != nil {
		return nil, mapNotFound(err)
	}
	_ = billing.OnPartnerOnboarded(ctx, "estate_agent", updated.ID, "", "", updated.OfficialRepCode)
	return updated, nil
}

//encore:api auth method=GET path=/estate/agents
func ListAgents(ctx context.Context, req *agencyIDReq) (*AgentsResponse, error) {
	if err := requirePrivileged(ctx); err != nil {
		return nil, err
	}
	list, err := agents.ListByAgency(ctx, req.AgencyID, false)
	if err != nil {
		return nil, err
	}
	return &AgentsResponse{Agents: list}, nil
}

//encore:api auth method=GET path=/estate/agents/all
func ListAllAgents(ctx context.Context) (*AgentsResponse, error) {
	if err := requirePrivileged(ctx); err != nil {
		return nil, err
	}
	list, err := agents.ListAll(ctx, false)
	if err != nil {
		return nil, err
	}
	return &AgentsResponse{Agents: list}, nil
}

//encore:api auth method=POST path=/estate/agent/active
func SetAgentActive(ctx context.Context, req *activeReq) (*okResp, error) {
	if err := requirePrivileged(ctx); err != nil {
		return nil, err
	}
	if err := agents.SetActive(ctx, req.ID, req.Active); err != nil {
		return nil, err
	}
	if req.Active {
		_ = billing.OnPartnerOnboarded(ctx, "estate_agent", req.ID, "", "", "")
		_ = billing.SetStatusByPartner(ctx, "estate_agent", req.ID, "Active")
	} else {
		_ = billing.SetStatusByPartner(ctx, "estate_agent", req.ID, "Cancelled")
	}
	return &okResp{OK: true}, nil
}

//encore:api auth method=DELETE path=/estate/agent
func DeleteAgent(ctx context.Context, req *idReq) (*okResp, error) {
	if err := requirePrivileged(ctx); err != nil {
		return nil, err
	}
	_ = billing.SetStatusByPartner(ctx, "estate_agent", req.ID, "Cancelled")
	if err := agents.Delete(ctx, req.ID); err != nil {
		return nil, mapNotFound(err)
	}
	return &okResp{OK: true}, nil
}

// ================= Properties =================

//encore:api auth method=POST path=/estate/property
func CreateProperty(ctx context.Context, req *appdb.EstateProperty) (*appdb.EstateProperty, error) {
	if err := requirePrivileged(ctx); err != nil {
		return nil, err
	}
	if req.AgencyID == 0 {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "agencyId is required"}
	}
	if strings.TrimSpace(req.Title) == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "property title is required"}
	}
	if err := moderation.BlockError(
		moderation.NamedField{Name: "title", Value: req.Title},
		moderation.NamedField{Name: "description", Value: req.Description},
	); err != nil {
		return nil, err
	}
	created, err := properties.Create(ctx, req)
	if err != nil {
		return nil, err
	}
	moderation.ScanAndFlag(ctx, "partner_profile", "estate_property", created.ID, created.Title, auth.ActorLabel(ctx),
		moderation.NamedField{Name: "title", Value: created.Title},
		moderation.NamedField{Name: "description", Value: created.Description},
	)
	return created, nil
}

//encore:api auth method=PUT path=/estate/property
func UpdateProperty(ctx context.Context, req *appdb.EstateProperty) (*appdb.EstateProperty, error) {
	if err := requirePrivileged(ctx); err != nil {
		return nil, err
	}
	if err := moderation.BlockError(
		moderation.NamedField{Name: "title", Value: req.Title},
		moderation.NamedField{Name: "description", Value: req.Description},
	); err != nil {
		return nil, err
	}
	updated, err := properties.Update(ctx, req.ID, req)
	if err != nil {
		return nil, mapNotFound(err)
	}
	return updated, nil
}

//encore:api auth method=GET path=/estate/properties
func ListProperties(ctx context.Context, req *agencyIDReq) (*PropertiesResponse, error) {
	if err := requirePrivileged(ctx); err != nil {
		return nil, err
	}
	list, err := properties.ListByAgency(ctx, req.AgencyID, false)
	if err != nil {
		return nil, err
	}
	return &PropertiesResponse{Properties: list}, nil
}

//encore:api auth method=POST path=/estate/property/active
func SetPropertyActive(ctx context.Context, req *activeReq) (*okResp, error) {
	if err := requirePrivileged(ctx); err != nil {
		return nil, err
	}
	if err := properties.SetActive(ctx, req.ID, req.Active); err != nil {
		return nil, err
	}
	return &okResp{OK: true}, nil
}

//encore:api auth method=DELETE path=/estate/property
func DeleteProperty(ctx context.Context, req *idReq) (*okResp, error) {
	if err := requirePrivileged(ctx); err != nil {
		return nil, err
	}
	if err := properties.Delete(ctx, req.ID); err != nil {
		return nil, mapNotFound(err)
	}
	return &okResp{OK: true}, nil
}

// ================= Public (guest/local) reads =================

type PublicAgencyResponse struct {
	Agency     appdb.EstateAgency     `json:"agency"`
	Agents     []appdb.EstateAgent    `json:"agents"`
	Properties []appdb.EstateProperty `json:"properties"`
}
type PublicAgentResponse struct {
	Agent      appdb.EstateAgent      `json:"agent"`
	Agency     appdb.EstateAgency     `json:"agency"`
	Properties []appdb.EstateProperty `json:"properties"`
}
type PublicPropertyResponse struct {
	Property appdb.EstateProperty `json:"property"`
	Agency   appdb.EstateAgency   `json:"agency"`
	Agent    *appdb.EstateAgent   `json:"agent,omitempty"`
}

//encore:api auth method=GET path=/estate/public/agencies
func PublicAgencies(ctx context.Context) (*AgenciesResponse, error) {
	list, err := agencies.List(ctx, true)
	if err != nil {
		return nil, err
	}
	for i := range list {
		list[i].StripSensitive()
	}
	return &AgenciesResponse{Agencies: list}, nil
}

//encore:api auth method=GET path=/estate/public/agents
func PublicAgents(ctx context.Context) (*AgentsResponse, error) {
	list, err := agents.ListAll(ctx, true)
	if err != nil {
		return nil, err
	}
	for i := range list {
		list[i].StripSensitive()
	}
	return &AgentsResponse{Agents: list}, nil
}

//encore:api auth method=GET path=/estate/public/properties
func PublicProperties(ctx context.Context) (*PropertiesResponse, error) {
	list, err := properties.ListAllActive(ctx)
	if err != nil {
		return nil, err
	}
	return &PropertiesResponse{Properties: list}, nil
}

//encore:api auth method=GET path=/estate/public/agency
func PublicAgency(ctx context.Context, req *codeReq) (*PublicAgencyResponse, error) {
	a, err := agencies.GetByCode(ctx, req.Code)
	if err != nil {
		return nil, mapNotFound(err)
	}
	agentList, _ := agents.ListByAgency(ctx, a.ID, true)
	propList, _ := properties.ListByAgency(ctx, a.ID, true)
	a.StripSensitive()
	for i := range agentList {
		agentList[i].StripSensitive()
	}
	return &PublicAgencyResponse{Agency: *a, Agents: agentList, Properties: propList}, nil
}

//encore:api auth method=GET path=/estate/public/agent
func PublicAgent(ctx context.Context, req *codeReq) (*PublicAgentResponse, error) {
	ag, err := agents.GetByCode(ctx, req.Code)
	if err != nil {
		return nil, mapNotFound(err)
	}
	propList, _ := properties.ListByAgent(ctx, ag.ID, true)
	agency, _ := agencies.Get(ctx, ag.AgencyID)
	ag.StripSensitive()
	out := &PublicAgentResponse{Agent: *ag, Properties: propList}
	if agency != nil {
		agency.StripSensitive()
		out.Agency = *agency
	}
	return out, nil
}

//encore:api auth method=GET path=/estate/public/property
func PublicProperty(ctx context.Context, req *idReq) (*PublicPropertyResponse, error) {
	p, err := properties.Get(ctx, req.ID)
	if err != nil {
		return nil, mapNotFound(err)
	}
	out := &PublicPropertyResponse{Property: *p}
	if agency, e := agencies.Get(ctx, p.AgencyID); e == nil {
		agency.StripSensitive()
		out.Agency = *agency
	}
	if p.AgentID != nil {
		if ag, e := agents.Get(ctx, *p.AgentID); e == nil {
			ag.StripSensitive()
			out.Agent = ag
		}
	}
	return out, nil
}

func mapNotFound(err error) error {
	switch err {
	case store.ErrEstateAgencyNotFound, store.ErrEstateAgentNotFound, store.ErrEstatePropertyNotFound:
		return &errs.Error{Code: errs.NotFound, Message: "not found"}
	}
	return err
}
