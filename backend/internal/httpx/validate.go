package httpx

import (
	"errors"
	"fmt"
	"net/http"
	"reflect"
	"regexp"
	"strings"
	"unicode"

	"github.com/go-playground/validator/v10"
)

var validate = newValidator()

func newValidator() *validator.Validate {
	v := validator.New(validator.WithRequiredStructEnabled())
	// Report field errors by JSON name so they match what the client sent.
	v.RegisterTagNameFunc(func(f reflect.StructField) string {
		name, _, _ := strings.Cut(f.Tag.Get("json"), ",")
		if name == "" || name == "-" {
			return f.Name
		}
		return name
	})
	mustRegister(v, "slug", slugRE)
	mustRegister(v, "phone", phoneRE)
	return v
}

var (
	// slugRE: lowercase letters and digits in groups joined by single hyphens.
	slugRE = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)
	// phoneRE: optional +, then digits with spaces, hyphens or parentheses.
	phoneRE = regexp.MustCompile(`^\+?[0-9][0-9 ()-]{5,18}[0-9]$`)
)

func mustRegister(v *validator.Validate, tag string, re *regexp.Regexp) {
	err := v.RegisterValidation(tag, func(fl validator.FieldLevel) bool {
		return re.MatchString(fl.Field().String())
	})
	if err != nil {
		panic(err)
	}
}

// Validate runs struct validation. On failure it writes a 422 with per-field
// messages and returns false.
func Validate(w http.ResponseWriter, s any) bool {
	err := validate.Struct(s)
	if err == nil {
		return true
	}
	var verrs validator.ValidationErrors
	if !errors.As(err, &verrs) {
		Error(w, http.StatusInternalServerError, CodeInternal, "Internal server error", nil)
		return false
	}
	fields := make(map[string]string, len(verrs))
	for _, fe := range verrs {
		fields[fe.Field()] = fieldMessage(fe)
	}
	Error(w, http.StatusUnprocessableEntity, CodeValidationFailed, "Request validation failed", fields)
	return false
}

func fieldMessage(fe validator.FieldError) string {
	switch fe.Tag() {
	case "required":
		return "is required"
	case "required_without":
		return "is required unless " + snakeCase(fe.Param()) + " is given"
	case "email":
		return "must be a valid email"
	case "uuid":
		return "must be a UUID"
	case "slug":
		return "must be lowercase letters and digits separated by single hyphens"
	case "phone":
		return "must be a valid phone number"
	case "oneof":
		return "must be one of: " + strings.ReplaceAll(fe.Param(), " ", ", ")
	case "min":
		if fe.Kind() == reflect.String {
			return fmt.Sprintf("must be at least %s characters", fe.Param())
		}
		return "must be at least " + fe.Param()
	case "max":
		if fe.Kind() == reflect.String {
			return fmt.Sprintf("must be at most %s characters", fe.Param())
		}
		return "must be at most " + fe.Param()
	default:
		return "is invalid"
	}
}

// snakeCase maps a Go field name (AdminNote) to its JSON name (admin_note).
func snakeCase(s string) string {
	var b strings.Builder
	for i, r := range s {
		if unicode.IsUpper(r) {
			if i > 0 {
				b.WriteByte('_')
			}
			r = unicode.ToLower(r)
		}
		b.WriteRune(r)
	}
	return b.String()
}
